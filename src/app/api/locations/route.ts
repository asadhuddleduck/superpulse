import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import {
  getLocationsForTenant,
  type LocationInput,
} from "@/lib/queries/locations";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";

async function requireTenantId(): Promise<string | NextResponse> {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return tenantId;
}

export async function GET() {
  const tenantId = await requireTenantId();
  if (typeof tenantId !== "string") return tenantId;
  const locations = await getLocationsForTenant(tenantId);
  return NextResponse.json({ locations });
}

export async function POST(request: NextRequest) {
  const tenantId = await requireTenantId();
  if (typeof tenantId !== "string") return tenantId;

  const body = (await request.json()) as Partial<LocationInput> & {
    address?: string;
  };

  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim();
  const radiusMiles = body.radiusMiles ?? 5;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  if (radiusMiles < 1 || radiusMiles > 50) {
    return NextResponse.json(
      { error: "Radius must be between 1 and 50 miles" },
      { status: 400 },
    );
  }

  // Allow caller to pre-supply lat/lng (e.g. from a future map-pin UI).
  let latitude = body.latitude;
  let longitude = body.longitude;
  let resolvedAddress = address;

  if (latitude == null || longitude == null) {
    const geo = await geocodeAddress(address);
    if (!geo) {
      return NextResponse.json(
        {
          error:
            "Couldn't find that address. Try a more specific street + town + postcode.",
        },
        { status: 400 },
      );
    }
    latitude = geo.latitude;
    longitude = geo.longitude;
    resolvedAddress = geo.displayName;
  }

  const result = await db.execute({
    sql: `
      INSERT INTO locations (tenant_id, name, address, latitude, longitude, radius_miles)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [tenantId, name, resolvedAddress, latitude, longitude, radiusMiles],
  });

  return NextResponse.json({
    location: {
      id: Number(result.rows[0]?.id),
      name,
      address: resolvedAddress,
      latitude,
      longitude,
      radiusMiles,
    },
  });
}
