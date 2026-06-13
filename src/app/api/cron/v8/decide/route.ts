import { NextResponse } from "next/server";
import { fetchAdInsights } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import {
  getTenantCampaign,
  getLocationAdsets,
  insertAiDecision,
  getActiveReelAdsForTenant,
  type LocationAdsetRow,
} from "@/lib/queries/v8";
import { enqueueIntent } from "@/lib/v8/intents";
import { applyTilts, FLOOR_PENNIES, COOLDOWN_MS } from "@/lib/v8/budget-tilt";
import { validateAiDecisionOutput, toTiltDirectives } from "@/lib/v8/validate";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { getLatestAppUsage } from "@/lib/queries/rate-limits";
import { getAnthropic, HAIKU_MODEL } from "@/lib/anthropic";

// v8 decide cron — 6-hour cadence. Per active tenant: per-app circuit breaker,
// build snapshot, ONE Anthropic Haiku call (prompt-cached system block),
// validate output, insert ai_decisions row, enqueue v8_intents. NO Meta writes.

export const maxDuration = 120;

const CIRCUIT_BREAKER_THRESHOLD = 50; // X-App-Usage % above which we skip
const APP_USAGE_FRESH_MS = 60 * 60 * 1000; // 1h lookback

const SYSTEM_PROMPT = `You are the SuperPulse v8 budget allocator. Each tick you receive a tenant snapshot — one campaign, N adsets (one per location), per-adset 7d performance, and a list of active ads. Your job: produce a JSON object with three fields:

  budget_tilts: array of { location_id: number, tilt: "up" | "down" | "neutral", reason: string }. ONE entry per adset in the snapshot. "up" = +25% next 24h, "down" = -25%, "neutral" = no change. The 3× spread guardrail is enforced downstream — don't worry about it. Cooldown_active=true on an adset means it was tilted in the last 24h; prefer "neutral" for it.

  stops: array of { meta_ad_id: string, reason: string }. Only ads you want stopped. Codified stop conditions (low CTR, high CPV, zero visits at £5, age > 60d) already run automatically — only stop here for reasons the codified rules can't see (e.g. obvious thematic mismatch, brand-safety concerns).

  narrative: one paragraph in plain English summarising what you did and why. The dashboard surfaces this verbatim.

Output ONLY the JSON object. No code fences, no surrounding prose. Bad output = silently dropped.`;

interface TenantDecideResult {
  tenantId: string;
  skipped?: string;
  aiDecisionId?: number;
  intentsEnqueued?: number;
  error?: string;
}

function estimateCostPennies(inputTokens: number, outputTokens: number): number {
  // Haiku 4.5 GBP pricing — rough; revisit when SDK exposes a cost field.
  return Math.round((inputTokens * 0.04 + outputTokens * 0.32) / 1000);
}

function extractJson(text: string): unknown {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON object found in model output");
  return JSON.parse(m[0]);
}

async function decideOneTenant(tenant: Tenant): Promise<TenantDecideResult> {
  const result: TenantDecideResult = { tenantId: tenant.id };

  // ---------- Per-app circuit breaker ----------
  const usage = await getLatestAppUsage();
  if (usage) {
    const ageMs = Date.now() - Date.parse(usage.capturedAt);
    if (ageMs <= APP_USAGE_FRESH_MS) {
      const peak = Math.max(usage.callCount, usage.cpuTime, usage.totalTime);
      if (peak > CIRCUIT_BREAKER_THRESHOLD) {
        await writeAuditEvent(
          tenant.id,
          "v8_circuit_breaker_tripped",
          `v8 decide: skipped — X-App-Usage ${peak}% in last hour`,
          { usage },
        );
        result.skipped = `circuit_breaker:${peak}%`;
        return result;
      }
    }
  }

  const token = tenant.metaAccessToken;
  const adAccountId = tenant.adAccountId;
  if (!token || !adAccountId) {
    result.error = "missing meta credentials";
    return result;
  }

  const tenantCampaign = await getTenantCampaign(tenant.id);
  if (!tenantCampaign) {
    result.skipped = "no v8 campaign";
    return result;
  }
  const adsets = await getLocationAdsets(tenantCampaign.id);
  if (adsets.length === 0) {
    result.skipped = "no adsets";
    return result;
  }

  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
  const insightsStart = Date.now();
  let insights;
  try {
    insights = await fetchAdInsights(cleanAdAccountId, token, { level: "adset" });
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?level=adset`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - insightsStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/act_${cleanAdAccountId}/insights?level=adset`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - insightsStart,
      error: err instanceof Error ? err.message : String(err),
    });
    result.error = `adset insights failed: ${err instanceof Error ? err.message : err}`;
    return result;
  }
  const adsetInsightMap = new Map<string, { impressions: number; clicks: number; spendPennies: number }>();
  for (const e of insights) {
    if (!e.adset_id) continue;
    adsetInsightMap.set(e.adset_id, {
      impressions: parseInt(e.impressions, 10) || 0,
      clicks: parseInt(e.clicks, 10) || 0,
      spendPennies: Math.round((parseFloat(e.spend) || 0) * 100),
    });
  }

  const reelAds = await getActiveReelAdsForTenant(tenant.id);

  // ---------- Build snapshot for the LLM ----------
  const now = Date.now();
  const userPayload = {
    tenantId: tenant.id,
    campaign: { metaCampaignId: tenantCampaign.metaCampaignId, dailyBudgetPennies: tenantCampaign.dailyBudgetPennies },
    adsets: adsets.map((a) => {
      const ins = adsetInsightMap.get(a.metaAdsetId);
      const cooldownActive = a.lastGuardrailWriteAt
        ? now - Date.parse(a.lastGuardrailWriteAt) < COOLDOWN_MS
        : false;
      return {
        location_id: a.locationId,
        meta_adset_id: a.metaAdsetId,
        daily_budget_pennies: a.dailyBudgetPennies ?? FLOOR_PENNIES,
        cooldown_active: cooldownActive,
        impressions_7d: ins?.impressions ?? 0,
        clicks_7d: ins?.clicks ?? 0,
        spend_pennies_7d: ins?.spendPennies ?? 0,
      };
    }),
    ads: reelAds.map((r) => ({
      meta_ad_id: r.metaAdId,
      meta_adset_id: r.metaAdsetId,
      added_at: r.addedAt,
      ai_score: r.aiScore,
    })),
  };

  const llmStart = Date.now();
  const anthropic = getAnthropic();
  let raw: unknown;
  let inputTokens = 0;
  let outputTokens = 0;
  let modelOutputText = "";
  try {
    const resp = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    });
    inputTokens = resp.usage.input_tokens;
    outputTokens = resp.usage.output_tokens;
    const part = resp.content.find((c) => c.type === "text");
    modelOutputText = part && part.type === "text" ? part.text : "";
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `anthropic:${HAIKU_MODEL}`,
      method: "POST",
      statusCode: 200,
      durationMs: Date.now() - llmStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `anthropic:${HAIKU_MODEL}`,
      method: "POST",
      statusCode: 500,
      durationMs: Date.now() - llmStart,
      error: err instanceof Error ? err.message : String(err),
    });
    result.error = `anthropic call failed: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  try {
    raw = extractJson(modelOutputText);
  } catch (err) {
    const aiId = await insertAiDecision({
      tenantId: tenant.id,
      decisionType: "BUDGET_TILT",
      inputJson: JSON.stringify(userPayload),
      outputJson: modelOutputText,
      llmModel: HAIKU_MODEL,
      inputTokens,
      outputTokens,
      costPennies: estimateCostPennies(inputTokens, outputTokens),
      narrative: "",
      valid: false,
    });
    await writeAuditEvent(tenant.id, "v8_decision_invalid", "Failed to extract JSON from LLM output", {
      aiDecisionId: aiId,
      error: err instanceof Error ? err.message : String(err),
    });
    result.aiDecisionId = aiId;
    result.skipped = "json_parse_failed";
    return result;
  }

  const validated = validateAiDecisionOutput(raw);
  if (!validated) {
    const aiId = await insertAiDecision({
      tenantId: tenant.id,
      decisionType: "BUDGET_TILT",
      inputJson: JSON.stringify(userPayload),
      outputJson: JSON.stringify(raw),
      llmModel: HAIKU_MODEL,
      inputTokens,
      outputTokens,
      costPennies: estimateCostPennies(inputTokens, outputTokens),
      narrative: "",
      valid: false,
    });
    await writeAuditEvent(tenant.id, "v8_decision_invalid", "AI output failed shape validation", {
      aiDecisionId: aiId,
      raw,
    });
    result.aiDecisionId = aiId;
    result.skipped = "validation_failed";
    return result;
  }

  // ---------- Persist + enqueue ----------
  const aiDecisionId = await insertAiDecision({
    tenantId: tenant.id,
    decisionType: "BUDGET_TILT",
    inputJson: JSON.stringify(userPayload),
    outputJson: JSON.stringify(validated),
    llmModel: HAIKU_MODEL,
    inputTokens,
    outputTokens,
    costPennies: estimateCostPennies(inputTokens, outputTokens),
    narrative: validated.narrative,
    valid: true,
  });
  result.aiDecisionId = aiDecisionId;

  // Pre-compute proposed budgets via applyTilts so payloads carry a hint.
  // Execute will re-validate against fresher state regardless.
  const directives = toTiltDirectives(validated);
  const { mutations } = applyTilts(adsets, directives, now);
  const adsetsByMetaId = new Map<string, LocationAdsetRow>(adsets.map((a) => [a.metaAdsetId, a]));

  let intentsEnqueued = 0;
  for (const tilt of validated.budget_tilts) {
    if (tilt.tilt === "neutral") continue;
    const adset = adsets.find((a) => a.locationId === tilt.location_id);
    if (!adset) continue;
    const mutation = mutations.find((m) => m.metaAdsetId === adset.metaAdsetId);
    if (!mutation) continue; // skipped by guardrail at enqueue-time
    await enqueueIntent({
      tenantId: tenant.id,
      aiDecisionId,
      intentType: "BUDGET_TILT",
      payload: {
        metaAdsetId: adset.metaAdsetId,
        newDailyBudgetPennies: mutation.newDailyBudgetPennies,
        reason: tilt.reason,
      },
    });
    intentsEnqueued++;
  }

  for (const stop of validated.stops) {
    await enqueueIntent({
      tenantId: tenant.id,
      aiDecisionId,
      intentType: "STOP_AD",
      payload: { metaAdId: stop.meta_ad_id, reason: stop.reason },
    });
    intentsEnqueued++;
  }

  result.intentsEnqueued = intentsEnqueued;

  await writeAuditEvent(
    tenant.id,
    "v8_decision_made",
    validated.narrative.slice(0, 500),
    {
      aiDecisionId,
      intentsEnqueued,
      tilts: validated.budget_tilts.length,
      stops: validated.stops.length,
      costPennies: estimateCostPennies(inputTokens, outputTokens),
    },
  );

  // Touch unused import so TS doesn't complain.
  void adsetsByMetaId;

  return result;
}

const TENANT_CONCURRENCY = 5;

async function runDecide() {
  const tenants = await getActiveTenants();
  const results: TenantDecideResult[] = new Array(tenants.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      try {
        results[i] = await decideOneTenant(tenants[i]);
      } catch (err) {
        results[i] = {
          tenantId: tenants[i].id,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  const workers = Array.from({ length: Math.min(TENANT_CONCURRENCY, tenants.length) }, () => worker());
  await Promise.all(workers);
  return {
    tenantsProcessed: tenants.length,
    intentsEnqueued: results.reduce((s, r) => s + (r.intentsEnqueued ?? 0), 0),
    skipped: results.filter((r) => r.skipped).length,
    errors: results.filter((r) => r.error).length,
    results,
  };
}

export async function GET(request: Request) {
  if (process.env.V8_ENGINE_ENABLED !== "on") {
    return NextResponse.json({ ok: false, skipped: true, reason: "v8 engine gated" });
  }
  const authError = checkCronAuth(request);
  if (authError) return authError;
  try {
    const summary = await runDecide();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("v8 decide cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
