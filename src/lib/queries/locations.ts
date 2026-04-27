import { db } from "@/lib/db";

export interface Location {
  id: number;
  tenantId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  createdAt: string;
}

export interface LocationInput {
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusMiles?: number;
}

function rowToLocation(row: Record<string, unknown>): Location {
  return {
    id: Number(row.id),
    tenantId: row.tenant_id as string,
    name: row.name as string,
    address: (row.address as string | null) ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMiles: Number(row.radius_miles),
    createdAt: row.created_at as string,
  };
}

export async function getLocationsForTenant(tenantId: string): Promise<Location[]> {
  const result = await db.execute({
    sql: `SELECT * FROM locations WHERE tenant_id = ? ORDER BY id`,
    args: [tenantId],
  });
  return result.rows.map(rowToLocation);
}

/**
 * Replace all locations for a tenant with the provided list. Used by the seed
 * script — idempotent per tenant.
 */
export async function replaceLocationsForTenant(
  tenantId: string,
  locations: LocationInput[],
): Promise<void> {
  await db.execute({
    sql: `DELETE FROM locations WHERE tenant_id = ?`,
    args: [tenantId],
  });
  for (const loc of locations) {
    await db.execute({
      sql: `
        INSERT INTO locations (tenant_id, name, address, latitude, longitude, radius_miles)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        tenantId,
        loc.name,
        loc.address ?? null,
        loc.latitude,
        loc.longitude,
        loc.radiusMiles ?? 5.0,
      ],
    });
  }
}
