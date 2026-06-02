import { NextResponse } from "next/server";
import { fetchIGMedia, getAdAccountStatus } from "@/lib/facebook";
import { checkCronAuth } from "@/lib/cron-auth";
import { getActiveTenants, type Tenant } from "@/lib/queries/tenants";
import { upsertPost } from "@/lib/queries/posts";
import { db } from "@/lib/db";
import { logApiCall } from "@/lib/queries/api-calls";
import { writeAuditEvent } from "@/lib/queries/audit-events";

// v8 scan cron — 60-minute cadence. Pulls IG media, filters Reels-only,
// upserts ig_posts, scores deterministically (no LLM), updates ai_score on
// existing reel_ads rows. NO Meta writes from this cron.
//
// Score formula: engagement = likes + 3*comments; ageHours = max(1, age_ms/3600000);
// score = engagement / ageHours. Reel-specific quality signals (skip_rate,
// avg_watch_time) deferred per V8-SPEC §"Open questions".

export const maxDuration = 60;

interface TenantScanResult {
  tenantId: string;
  reelsScanned: number;
  newReelsMarkedEligible: number;
  error?: string;
}

function scoreReel(likes: number, comments: number, timestamp: string, now: number): number {
  const engagement = likes + 3 * comments;
  const ageHours = Math.max(1, (now - Date.parse(timestamp)) / 3600000);
  return engagement / ageHours;
}

async function processTenant(tenant: Tenant, now: number): Promise<TenantScanResult> {
  const result: TenantScanResult = {
    tenantId: tenant.id,
    reelsScanned: 0,
    newReelsMarkedEligible: 0,
  };

  const token = tenant.metaAccessToken;
  const igUserId = tenant.igUserId;
  const adAccountId = tenant.adAccountId;
  if (!token || !igUserId || !adAccountId) {
    result.error = "Tenant missing Meta credentials";
    return result;
  }

  const cleanAdAccountId = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;

  // Ad-account health check — skip the tenant if Meta has disabled the account.
  try {
    const acct = await getAdAccountStatus(cleanAdAccountId, token);
    if (!acct || acct.accountStatus !== 1) {
      result.error = `ad account status ${acct?.accountStatus ?? "unknown"}`;
      return result;
    }
  } catch (err) {
    result.error = `ad account check failed: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  const fetchStart = Date.now();
  let media;
  try {
    media = await fetchIGMedia(igUserId, token);
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/${igUserId}/media`,
      method: "GET",
      statusCode: 200,
      durationMs: Date.now() - fetchStart,
    });
  } catch (err) {
    await logApiCall({
      tenantId: tenant.id,
      endpoint: `/${igUserId}/media`,
      method: "GET",
      statusCode: 500,
      durationMs: Date.now() - fetchStart,
      error: err instanceof Error ? err.message : String(err),
    });
    result.error = `IG media fetch failed: ${err instanceof Error ? err.message : err}`;
    return result;
  }

  const reels = media.filter((m) => m.media_product_type === "REELS");

  for (const reel of reels) {
    result.reelsScanned++;
    const score = scoreReel(reel.like_count ?? 0, reel.comments_count ?? 0, reel.timestamp, now);

    // Coerce IG media_type to local enum. Reels report VIDEO at the media_type level.
    const localMediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" =
      reel.media_type === "VIDEO" ? "VIDEO" : reel.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL_ALBUM" : "IMAGE";

    await upsertPost(
      {
        id: reel.id,
        mediaUrl: reel.media_url ?? "",
        thumbnailUrl: reel.thumbnail_url ?? "",
        caption: reel.caption ?? "",
        timestamp: reel.timestamp,
        likeCount: reel.like_count ?? 0,
        commentsCount: reel.comments_count ?? 0,
        mediaType: localMediaType,
        engagementRate: score,
      },
      tenant.id,
    );

    // Update ai_score on any existing reel_ads row for this post (no INSERT —
    // reel_ads rows are created by the bootstrap or future onboarding flow,
    // not the scan cron).
    await db.execute({
      sql: `UPDATE reel_ads SET ai_score = ? WHERE post_id = ?`,
      args: [score, reel.id],
    });
  }

  await writeAuditEvent(tenant.id, "v8_scan_tick", `Scanned ${result.reelsScanned} Reels`, {
    reelsScanned: result.reelsScanned,
    newReelsMarkedEligible: result.newReelsMarkedEligible,
  });

  return result;
}

const TENANT_CONCURRENCY = 5;

async function runScan() {
  const tenants = await getActiveTenants();
  const results: TenantScanResult[] = new Array(tenants.length);
  const now = Date.now();

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tenants.length) return;
      const tenant = tenants[i];
      try {
        results[i] = await processTenant(tenant, now);
      } catch (err) {
        results[i] = {
          tenantId: tenant.id,
          reelsScanned: 0,
          newReelsMarkedEligible: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(TENANT_CONCURRENCY, tenants.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return {
    tenantsProcessed: tenants.length,
    reelsScanned: results.reduce((sum, r) => sum + r.reelsScanned, 0),
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
    const summary = await runScan();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("v8 scan cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
