import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import { getTenantById, upsertTenant } from "@/lib/queries/tenants";
import {
  fetchIGUsername,
  fetchPagesWithIG,
} from "@/lib/facebook";

interface SelectPageBody {
  pageId?: unknown;
}

async function selectPage(pageId: string) {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const token = tenant.metaAccessToken;
  if (!token) {
    return NextResponse.json({ error: "Token expired — please log in again" }, { status: 401 });
  }

  const pages = await fetchPagesWithIG(token);

  const chosen = pages.find((p) => p.id === pageId);
  if (!chosen || !chosen.instagram_business_account) {
    return NextResponse.json(
      { error: "Selected Page is not linked to an Instagram Business Account" },
      { status: 400 },
    );
  }

  const igUserId = chosen.instagram_business_account.id;
  let igUsername: string | null = null;
  try {
    igUsername = await fetchIGUsername(igUserId, token);
  } catch {
    // Username is best-effort; cron will backfill on next scan.
  }

  // Pre-existing ad_account_id (e.g. seeded legacy tenants) is preserved and
  // skips straight to active. Otherwise the user MUST go through the
  // ad-account picker — no more silent adAccounts[0] auto-bind.
  const nextStatus = tenant.adAccountId ? "active" : "pending_ad_account";

  await upsertTenant({
    id: tenantId,
    igUserId,
    pageId: chosen.id,
    igUsername,
    name: chosen.name,
    status: nextStatus,
  });

  return NextResponse.json({ ok: true, nextStatus });
}

// POST only — selectPage() rebinds the tenant's Page/IG (a state change), so it
// must not ride on a GET. A GET write was CSRF-able under the sameSite=lax auth
// cookie (a top-level link navigation sends the cookie) and bypassed
// impersonationGuard. The single-page short-circuit now auto-submits to this
// guarded POST from the client (see onboarding/select-page/page.tsx).
export async function POST(request: NextRequest) {
  const ro = await impersonationGuard();
  if (ro) return ro;
  const body = (await request.json().catch(() => ({}))) as SelectPageBody;
  const pageId = typeof body.pageId === "string" ? body.pageId : null;
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }
  return selectPage(pageId);
}
