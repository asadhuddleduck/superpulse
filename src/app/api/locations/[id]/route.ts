import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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
