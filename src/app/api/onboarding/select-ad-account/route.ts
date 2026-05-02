import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById, upsertTenant } from "@/lib/queries/tenants";
import { fetchAdAccounts } from "@/lib/facebook";
import { writeAuditEvent } from "@/lib/queries/audit-events";

interface SelectAdAccountBody {
  adAccountId?: unknown;
}

async function selectAdAccount(adAccountId: string) {
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

  // Server-side validation: the ID has to belong to an ad account on this
  // user's token AND that account has to be ACTIVE. Stops a tampered request
  // from binding an account the user isn't authorised to spend on.
  const accounts = await fetchAdAccounts(token);
  const matched = accounts.find((a) => {
    const raw = a.id.startsWith("act_") ? a.id.slice(4) : a.id;
    return raw === adAccountId;
  });

  if (!matched) {
    return NextResponse.json(
      { error: "That ad account isn't on your Meta login." },
      { status: 400 },
    );
  }
  if (matched.account_status !== 1) {
    return NextResponse.json(
      { error: "That ad account isn't active. Pick a different one or fix billing in Meta Business Suite." },
      { status: 400 },
    );
  }

  const previousAdAccountId = tenant.adAccountId ?? null;

  await upsertTenant({
    id: tenantId,
    adAccountId,
    status: "active",
  });

  await writeAuditEvent(
    tenantId,
    "onboarding_complete",
    `Ad account bound: ${matched.name} (act_${adAccountId})`,
    {
      adAccountId,
      adAccountName: matched.name,
      businessId: matched.business?.id ?? null,
      businessName: matched.business?.name ?? null,
      previousAdAccountId,
    },
  );

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SelectAdAccountBody;
  const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId : null;
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }
  return selectAdAccount(adAccountId);
}
