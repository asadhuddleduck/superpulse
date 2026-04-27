import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/queries/settings";

export async function GET() {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getSettings(tenantId);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("Failed to fetch boost settings:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const dailyBudgetCap =
      typeof body.dailyBudgetCap === "number" ? body.dailyBudgetCap : undefined;
    const targetRadiusMiles =
      typeof body.targetRadiusMiles === "number"
        ? body.targetRadiusMiles
        : undefined;
    const autoBoostEnabled =
      typeof body.autoBoostEnabled === "boolean"
        ? body.autoBoostEnabled
        : undefined;

    if (
      dailyBudgetCap === undefined &&
      targetRadiusMiles === undefined &&
      autoBoostEnabled === undefined
    ) {
      return NextResponse.json(
        { error: "At least one setting field is required" },
        { status: 400 }
      );
    }

    const current = await getSettings(tenantId);

    const updated = {
      tenantId,
      dailyBudgetCap: dailyBudgetCap ?? current.dailyBudgetCap,
      targetRadiusMiles: targetRadiusMiles ?? current.targetRadiusMiles,
      autoBoostEnabled: autoBoostEnabled ?? current.autoBoostEnabled,
    };

    await upsertSettings(updated);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update boost settings:", err);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
