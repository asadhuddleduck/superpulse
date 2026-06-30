import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import { getTenantById, upsertTenant, setProvisioningStatus } from "@/lib/queries/tenants";
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

  // v8: kick off the budget-intake → provisioning flow. Written for EVERY
  // non-legacy onboarding tenant regardless of V8_ENGINE_ENABLED — the write must
  // NOT be flag-gated. If it were (the old behaviour), a tenant who finishes
  // onboarding while the flag is OFF lands at status='active' with
  // provisioning_status=NULL; when the flag later flips ON they fall through every
  // v8 gate (getTenantsAwaitingProvision requires provisioning IN
  // ('provisioning','provisioned'); the dashboard gate only redirects on the named
  // provisioning states) — paying, "connected", and never provisioned. Stamping
  // pending_locations here is inert while the flag is OFF (the dashboard v8 gate
  // and every v8 cron are themselves flag-gated, and pending_locations is not in
  // getTenantsAwaitingProvision's set) and routes them straight into
  // /onboarding/locations the moment the flag turns ON. Legacy/seeded short-circuit
  // tenants never reach this route (they bind their ad account pre-seeded and jump
  // to 'active' in the OAuth callback, skipping the picker), so this can't pull
  // them into the funnel.
  if (!tenant.legacy) {
    await setProvisioningStatus(tenantId, "pending_locations");
  }

  await writeAuditEvent(
    tenantId,
    "onboarding_complete",
    `Ad account bound: ${matched.name} (act_${adAccountId})`,
    {
      adAccountId,
      adAccountName: matched.name,
      previousAdAccountId,
    },
  );

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const ro = await impersonationGuard();
  if (ro) return ro;
  const body = (await request.json().catch(() => ({}))) as SelectAdAccountBody;
  const adAccountId = typeof body.adAccountId === "string" ? body.adAccountId : null;
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }
  return selectAdAccount(adAccountId);
}
