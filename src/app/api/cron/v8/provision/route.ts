import { NextResponse } from "next/server";
import { getAdAccountStatus } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import {
  getTenantsAwaitingProvision,
  setProvisioningStatus,
  type Tenant,
} from "@/lib/queries/tenants";
import { getLocationsForTenant } from "@/lib/queries/locations";
import { getPendingCreationIntents } from "@/lib/v8/intents";
import {
  ensureCampaignRow,
  findMissingAdsetLocations,
  findMissingAdPairs,
  enqueueProvisionIntents,
} from "@/lib/v8/provision";
import { validateTenantBudget } from "@/lib/v8/budget-plan";
import { guardTenant, CREATION_BREAKER_THRESHOLD } from "@/lib/v8/circuit-breaker";
import { getProvisioningProgress } from "@/lib/queries/v8";
import { writeAuditEvent, hasRecentAuditEvent } from "@/lib/queries/audit-events";
import { classifyMetaError, classifyMetaAccessError } from "@/lib/meta-errors";
import { notifySlack } from "@/lib/slack";

// v8 provision cron — 5-min cadence. PRODUCER: per active+provisioning,
// non-legacy tenant, ensure the campaign row exists then enqueue the missing
// PROVISION_ADSET / CREATE_AD intents (diff-based, deduped, bounded). The
// execute cron drains them. No Meta writes here except the single idempotent
// campaign create inside ensureCampaignRow. Gated by V8_ENGINE_ENABLED.

export const maxDuration = 60;

const PROVISION_CONCURRENCY = 5;
const MAX_ENQUEUE_PER_TICK = 200;

interface TenantProvisionResult {
  tenantId: string;
  campaignReady: boolean;
  adsetIntentsEnqueued: number;
  adIntentsEnqueued: number;
  provisioned?: boolean;
  skipped?: string;
  error?: string;
}

async function provisionOneTenant(tenant: Tenant): Promise<TenantProvisionResult> {
  const result: TenantProvisionResult = {
    tenantId: tenant.id,
    campaignReady: false,
    adsetIntentsEnqueued: 0,
    adIntentsEnqueued: 0,
  };

  // Conservative per-app breaker for the burst writer.
  const breaker = await guardTenant(tenant.id, CREATION_BREAKER_THRESHOLD, "provision");
  if (breaker.tripped) {
    result.skipped = breaker.reason ?? "circuit_breaker";
    return result;
  }

  const token = tenant.metaAccessToken;
  const adAccountId = tenant.adAccountId;
  if (!token || !adAccountId || !tenant.pageId || !tenant.igUserId || !tenant.igUsername) {
    result.skipped = "missing meta credentials";
    return result;
  }
  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  // Ad-account health — never provision onto a disabled account.
  try {
    const acct = await getAdAccountStatus(cleanAdAccountId, token);
    if (!acct || acct.accountStatus !== 1) {
      result.skipped = `ad account status ${acct?.accountStatus ?? "unknown"}`;
      return result;
    }
  } catch (err) {
    result.skipped = `ad account check failed: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  const locations = await getLocationsForTenant(tenant.id);
  if (locations.length === 0) {
    result.skipped = "no locations";
    return result;
  }

  // Pre-flight budget guard — recompute against the CURRENT location count
  // (locations may have changed between approval and provisioning).
  const budget = validateTenantBudget(tenant.monthlyAdBudgetPennies ?? 0, locations.length);
  if (!budget.ok) {
    // Self-fixable cause: client raises budget OR removes locations. Persist
    // 'budget' so the dashboard routes them back to re-approve (or auto-resumes
    // if it already re-validates) rather than re-deriving the cause.
    await setProvisioningStatus(tenant.id, "provision_failed", "budget");
    await writeAuditEvent(tenant.id, "v8_provision_failed", budget.message ?? "budget too tight", {
      locations: locations.length,
      monthlyAdBudgetPennies: tenant.monthlyAdBudgetPennies,
      minMonthlyPennies: budget.minMonthlyPennies,
    });
    result.skipped = "budget_too_tight";
    return result;
  }

  // The only Meta write in this lane is the campaign create inside
  // ensureCampaignRow. A permanent access failure here (expired token, no
  // ads_management grant, user not yet an app tester, ad-account access lost)
  // would otherwise bubble to runProvision's summary-only catch — no audit
  // event, no status change — leaving the tenant stuck in 'provisioning' and
  // retrying every 5 min forever, invisibly. Catch it, surface it, and park the
  // tenant in 'provision_failed' (excluded from getTenantsAwaitingProvision)
  // so the loop stops and Asad gets a Slack ping to act. Transient errors are
  // re-thrown so they still retry next tick.
  let campaign: Awaited<ReturnType<typeof ensureCampaignRow>>;
  try {
    campaign = await ensureCampaignRow(tenant);
  } catch (err) {
    const access = classifyMetaAccessError(err);
    const rejection = classifyMetaError(err);
    if (!access && !rejection?.permanent) throw err; // transient → retry next tick
    const reason = access?.reason ?? rejection!.reason;
    // Operational cause (token/permission/policy). Persist 'access' so the
    // dashboard never bounces them to the budget step (re-approving wouldn't
    // help and would loop); it renders the dashboard where the failure shows.
    await setProvisioningStatus(tenant.id, "provision_failed", "access");
    await writeAuditEvent(tenant.id, "v8_provision_failed", `Provisioning blocked: ${reason}`, {
      reason,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
    });
    void notifySlack(
      `🔴 SuperPulse provisioning blocked — *${tenant.name ?? tenant.id}* (${reason}). ` +
        `Campaign create was rejected by Meta. Likely needs the user added as an app tester / ` +
        `re-auth / ad-account access. Tenant parked in provision_failed.`,
    );
    result.skipped = `provision_failed:${reason}`;
    return result;
  }
  result.campaignReady = true;

  const [missingLocations, missingPairs, pending] = await Promise.all([
    findMissingAdsetLocations(tenant.id, campaign.id),
    findMissingAdPairs(tenant.id, campaign.id),
    getPendingCreationIntents(tenant.id),
  ]);

  const { adsetIntentsEnqueued, adIntentsEnqueued } = await enqueueProvisionIntents(
    tenant.id,
    missingLocations,
    missingPairs,
    pending,
    MAX_ENQUEUE_PER_TICK,
  );
  result.adsetIntentsEnqueued = adsetIntentsEnqueued;
  result.adIntentsEnqueued = adIntentsEnqueued;

  if (adsetIntentsEnqueued + adIntentsEnqueued > 0) {
    await writeAuditEvent(
      tenant.id,
      "v8_provision_started",
      `Enqueued ${adsetIntentsEnqueued} adset + ${adIntentsEnqueued} ad intents`,
      { locations: locations.length, missingAdsets: missingLocations.length, missingAdPairs: missingPairs.length },
    );
  } else if (missingLocations.length === 0 && missingPairs.length === 0 && pending.length === 0) {
    // Fully built: every adset + ad row exists and nothing is queued. But "rows
    // exist" is NOT "ads are live" — ads are created PAUSED and only go ACTIVE
    // after Meta review (monitor cron), and a copyright/policy disapproval RETIRES
    // the row (status PAUSED, retired_at set) without deleting it. getReelAdPairKeys
    // counts retired rows, so missingPairs hits 0 even when every ad was rejected.
    // Gate 'provisioned' on >=1 genuinely live ad so the status never overstates
    // delivery (a billed tenant with zero running ads must not read as "done").
    const progress = await getProvisioningProgress(tenant.id);
    const adsActive = progress?.adsActive ?? 0;
    const adsTotal = progress?.adsTotal ?? 0;
    const adsRetired = progress?.adsRetired ?? 0;

    if (adsActive > 0) {
      // At least one ad is live — genuine milestone. Stays in scope so new Reels
      // keep getting ads on the ongoing diff.
      if (tenant.provisioningStatus !== "provisioned") {
        await setProvisioningStatus(tenant.id, "provisioned");
        await writeAuditEvent(tenant.id, "v8_provision_completed", `Provisioned ${locations.length} locations`, {
          locations: locations.length,
          adsActive,
          adsTotal,
        });
      }
      result.provisioned = true;
    } else if (adsTotal > 0 && adsRetired >= adsTotal) {
      // Built but every ad was disapproved/retired (e.g. all reels carry copyright
      // music) → nothing will ever deliver from current content. Do NOT mark
      // 'provisioned'. Leave the tenant in 'provisioning' so a freshly-posted clean
      // Reel still self-heals on a later tick (provision_failed would exclude it
      // from the cron and block recovery). Slack-alert once per 24h (deduped via
      // the audit log) so this surfaces instead of silently sitting "done".
      if (!(await hasRecentAuditEvent(tenant.id, "v8_no_eligible_content", 24))) {
        await writeAuditEvent(
          tenant.id,
          "v8_no_eligible_content",
          `All ${adsTotal} ads rejected — nothing live`,
          { adsTotal, adsRetired },
        );
        void notifySlack(
          `🟠 SuperPulse — *${tenant.name ?? tenant.id}*: all ${adsTotal} ads were rejected ` +
            `(likely copyright music); nothing is live. Auto-recovers when a clean Reel is posted.`,
        );
      }
      // result.provisioned stays false — status remains 'provisioning'.
    }
    // else: ads exist but are still PAUSED awaiting Meta review — normal transient
    // state. Stay 'provisioning' silently; the monitor cron activates them.
  }

  return result;
}

async function runProvision() {
  const tenants = await getTenantsAwaitingProvision();
  const results: TenantProvisionResult[] = new Array(tenants.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      const tenant = tenants[i];
      try {
        results[i] = await provisionOneTenant(tenant);
      } catch (err) {
        results[i] = {
          tenantId: tenant.id,
          campaignReady: false,
          adsetIntentsEnqueued: 0,
          adIntentsEnqueued: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(PROVISION_CONCURRENCY, tenants.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return {
    tenantsProcessed: tenants.length,
    adsetIntentsEnqueued: results.reduce((s, r) => s + (r?.adsetIntentsEnqueued ?? 0), 0),
    adIntentsEnqueued: results.reduce((s, r) => s + (r?.adIntentsEnqueued ?? 0), 0),
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
    const summary = await runProvision();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("v8 provision cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
