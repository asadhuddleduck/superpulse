import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById, upsertTenant } from "@/lib/queries/tenants";
import {
  fetchAdAccounts,
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

  const [pages, adAccounts] = await Promise.all([
    fetchPagesWithIG(token),
    fetchAdAccounts(token).catch(() => []),
  ]);

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

  const rawAdAccountId = adAccounts[0]?.id ?? null;
  const adAccountId = rawAdAccountId
    ? rawAdAccountId.startsWith("act_")
      ? rawAdAccountId.slice(4)
      : rawAdAccountId
    : null;

  await upsertTenant({
    id: tenantId,
    igUserId,
    adAccountId,
    pageId: chosen.id,
    igUsername,
    name: chosen.name,
    status: "active",
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SelectPageBody;
  const pageId = typeof body.pageId === "string" ? body.pageId : null;
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }
  return selectPage(pageId);
}

// GET form lets the page server-redirect for the single-page short-circuit case.
export async function GET(request: NextRequest) {
  const pageId = request.nextUrl.searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.redirect(new URL("/onboarding/select-page", request.url));
  }
  const result = await selectPage(pageId);
  if (result.status >= 400) return result;
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
