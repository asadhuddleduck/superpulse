import { db } from "@/lib/db";
import type { BoostSettings } from "@/lib/types";

export async function getSettings(tenantId: string): Promise<BoostSettings> {
  const result = await db.execute({
    sql: "SELECT * FROM boost_settings WHERE tenant_id = ?",
    args: [tenantId],
  });

  if (result.rows.length === 0) {
    // Return defaults if no settings exist yet
    return {
      tenantId,
      dailyBudgetCap: 5.0,
      targetRadiusMiles: 5.0,
      autoBoostEnabled: true,
    };
  }

  return rowToSettings(result.rows[0]);
}

export async function upsertSettings(settings: BoostSettings): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO boost_settings
      (tenant_id, daily_budget_cap, target_radius_miles, auto_boost_enabled)
      VALUES (?, ?, ?, ?)`,
    args: [
      settings.tenantId,
      settings.dailyBudgetCap,
      settings.targetRadiusMiles,
      settings.autoBoostEnabled ? 1 : 0,
    ],
  });
}

function rowToSettings(row: Record<string, unknown>): BoostSettings {
  return {
    tenantId: row.tenant_id as string,
    dailyBudgetCap: row.daily_budget_cap as number,
    targetRadiusMiles: row.target_radius_miles as number,
    autoBoostEnabled: (row.auto_boost_enabled as number) === 1,
  };
}
