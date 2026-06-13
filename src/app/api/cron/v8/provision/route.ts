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
import { writeAuditEvent } from "@/lib/queries/audit-events";

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
    await setProvisioningStatus(tenant.id, "provision_failed");
    await writeAuditEvent(tenant.id, "v8_provision_failed", budget.message ?? "budget too tight", {
      locations: locations.length,
      monthlyAdBudgetPennies: tenant.monthlyAdBudgetPennies,
      minMonthlyPennies: budget.minMonthlyPennies,
    });
    result.skipped = "budget_too_tight";
    return result;
  }

  const campaign = await ensureCampaignRow(tenant);
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
    // Fully built (all adsets + ads created, nothing queued). Mark the milestone
    // for the dashboard; the tenant stays in scope so new Reels keep getting ads.
    if (tenant.provisioningStatus !== "provisioned") {
      await setProvisioningStatus(tenant.id, "provisioned");
      await writeAuditEvent(tenant.id, "v8_provision_completed", `Provisioned ${locations.length} locations`, {
        locations: locations.length,
      });
    }
    result.provisioned = true;
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
