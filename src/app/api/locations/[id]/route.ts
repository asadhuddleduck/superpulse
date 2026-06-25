import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import { db } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // View-as-client is read-only — never delete a client's location.
  const ro = await impersonationGuard();
  if (ro) return ro;

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const tenantId = tenant.id;

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Scoped delete — a tenant can only remove their own locations.
  await db.execute({
    sql: `DELETE FROM locations WHERE id = ? AND tenant_id = ?`,
    args: [numericId, tenantId],
  });

  return NextResponse.json({ ok: true });
}
