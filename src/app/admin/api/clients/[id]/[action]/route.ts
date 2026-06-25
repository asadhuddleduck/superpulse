import { NextRequest, NextResponse } from "next/server";
import { getHqUser, hasRole } from "@/lib/hq-auth";
import {
  getTenantById,
  setTenantPaused,
  setTenantComp,
  offboardTenant,
  reinstateTenant,
} from "@/lib/queries/tenants";
import { pauseAllCampaigns, offboardSideEffects } from "@/lib/hq-lifecycle";
import { writeAuditEvent } from "@/lib/queries/audit-events";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

// Lifecycle controls for a single client. Pause/reactivate/comp are member+;
// offboard/reinstate require admin+. Per the ≥1p-spend rule, nothing is deleted.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const user = await getHqUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id, action } = await ctx.params;
  const tenant = await getTenantById(id);
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const back = NextResponse.redirect(new URL(`/admin/clients/${encodeURIComponent(id)}`, req.url), 303);
  const forbidden = NextResponse.redirect(new URL(`/admin/clients/${encodeURIComponent(id)}?error=forbidden`, req.url), 303);

  switch (action) {
    case "pause": {
      await setTenantPaused(id, true);
      const paused = await pauseAllCampaigns(id);
      await writeAuditEvent(id, "subscription_changed", `Paused via HQ — ${paused} campaigns paused`, { paused });
      await logHqAction(user.id, "pause_client", { targetTenantId: id, metadata: { paused } });
      return back;
    }
    case "reactivate": {
      await setTenantPaused(id, false);
      await writeAuditEvent(id, "subscription_changed", "Reactivated via HQ — processing resumes");
      await logHqAction(user.id, "reactivate_client", { targetTenantId: id });
      return back;
    }
    case "comp": {
      await setTenantComp(id, true);
      await logHqAction(user.id, "comp_client", { targetTenantId: id, metadata: { comp: true } });
      return back;
    }
    case "uncomp": {
      await setTenantComp(id, false);
      await logHqAction(user.id, "comp_client", { targetTenantId: id, metadata: { comp: false } });
      return back;
    }
    case "offboard": {
      if (!(await hasRole(user, "admin"))) return forbidden;
      await offboardSideEffects(id);
      await offboardTenant(id);
      await logHqAction(user.id, "offboard_client", { targetTenantId: id });
      return back;
    }
    case "reinstate": {
      if (!(await hasRole(user, "admin"))) return forbidden;
      const reinstated = await reinstateTenant(id);
      if (!reinstated) {
        return NextResponse.redirect(
          new URL(`/admin/clients/${encodeURIComponent(id)}?error=not_offboarded`, req.url),
          303,
        );
      }
      await writeAuditEvent(id, "subscription_changed", "Reinstated via HQ — comp not restored, re-comp if needed");
      await logHqAction(user.id, "reinstate_client", { targetTenantId: id });
      return back;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
}
