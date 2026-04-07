import { NextRequest, NextResponse } from "next/server";
import { getTokenCookie } from "@/lib/auth";
import { getSettings, upsertSettings } from "@/lib/queries/settings";

const DEFAULT_TENANT_ID = "default";

export async function GET() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getSettings(DEFAULT_TENANT_ID);
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
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
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

    // Fetch current settings to merge with updates
    const current = await getSettings(DEFAULT_TENANT_ID);

    const updated = {
      tenantId: DEFAULT_TENANT_ID,
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
