import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth";
import { impersonationGuard } from "@/lib/hq-auth";
import {
  getLocationsForTenant,
  type LocationInput,
} from "@/lib/queries/locations";
import { setTenantPaidLocations } from "@/lib/queries/tenants";
import {
  SEAT_PRICE_PENNIES,
  MAX_LOCATIONS,
  clampSeatCount,
  resolveSeatCap,
  getSubscriptionQuantity,
  setSubscriptionQuantity,
} from "@/lib/seats";
import { db } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";

interface LocationRow {
  id: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusMiles: number;
}

function rowToLocation(row: Record<string, unknown> | undefined): LocationRow | null {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name as string,
    address: (row.address as string | null) ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMiles: Number(row.radius_miles),
  };
}

async function findLocationByAddress(
  tenantId: string,
  address: string,
): Promise<LocationRow | null> {
  const res = await db.execute({
    sql: `SELECT id, name, address, latitude, longitude, radius_miles
            FROM locations WHERE tenant_id = ? AND address = ? LIMIT 1`,
    args: [tenantId, address],
  });
  return rowToLocation(res.rows[0] as Record<string, unknown> | undefined);
}

export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const [locations, cap] = await Promise.all([
    getLocationsForTenant(tenant.id),
    resolveSeatCap(tenant),
  ]);
  return NextResponse.json({
    locations,
    unlimited: cap === Infinity,
    paidLocations: cap === Infinity ? null : cap,
    seatPricePennies: SEAT_PRICE_PENNIES,
  });
}

export async function POST(request: NextRequest) {
  // View-as-client is read-only — never write to (or bill) a client's account.
  const ro = await impersonationGuard();
  if (ro) return ro;

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<LocationInput> & {
    address?: string;
    addSeat?: boolean;
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

  // Geocode BEFORE any billing so a bad address never charges a seat.
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

  // Idempotency: a lost-ACK retry / replay re-POSTs the same address. If we
  // already have it, return it WITHOUT inserting again or charging a seat.
  const dup = await findLocationByAddress(tenant.id, resolvedAddress);
  if (dup) {
    const cap = await resolveSeatCap(tenant);
    return NextResponse.json({
      location: { ...dup, address: resolvedAddress },
      deduped: true,
      unlimited: cap === Infinity,
      paidLocations: cap === Infinity ? null : cap,
    });
  }

  let seatCap = await resolveSeatCap(tenant);

  // Backfill paid_locations from the live Stripe quantity here (a genuine,
  // impersonation-guarded write context — resolveSeatCap itself never writes).
  if (
    seatCap !== Infinity &&
    seatCap > 0 &&
    tenant.paidLocations == null &&
    tenant.stripeSubscriptionId
  ) {
    await setTenantPaidLocations(tenant.id, seatCap);
  }

  // Gate: a metered tenant at their paid cap must opt in to a paid seat.
  if (seatCap !== Infinity) {
    const current = (await getLocationsForTenant(tenant.id)).length;
    if (current >= seatCap) {
      if (body.addSeat !== true) {
        return NextResponse.json(
          {
            error: "seat_required",
            paidLocations: seatCap,
            currentLocations: current,
            seatPricePennies: SEAT_PRICE_PENNIES,
          },
          { status: 402 },
        );
      }
      if (!tenant.stripeSubscriptionId) {
        return NextResponse.json(
          {
            error: "no_subscription",
            message: "No active subscription on file to add a seat to.",
          },
          { status: 402 },
        );
      }
      if (current >= MAX_LOCATIONS) {
        return NextResponse.json(
          {
            error: "max_locations",
            message: `You're at the ${MAX_LOCATIONS}-location self-serve limit. Get in touch and we'll set the rest up for you.`,
          },
          { status: 409 },
        );
      }
    }
  }

  // Insert first, ON CONFLICT no-op (the unique (tenant_id,address) index makes a
  // racing replay a no-op rather than a duplicate row + second charge).
  const ins = await db.execute({
    sql: `
      INSERT INTO locations (tenant_id, name, address, latitude, longitude, radius_miles)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, address) DO NOTHING
      RETURNING id
    `,
    args: [tenant.id, name, resolvedAddress, latitude, longitude, radiusMiles],
  });

  // Conflict (a concurrent replay won the race): return the existing row, no charge.
  if (!ins.rows[0]) {
    const existing = await findLocationByAddress(tenant.id, resolvedAddress);
    return NextResponse.json({
      location: existing
        ? { ...existing, address: resolvedAddress }
        : { id: 0, name, address: resolvedAddress, latitude, longitude, radiusMiles },
      deduped: true,
      unlimited: seatCap === Infinity,
      paidLocations: seatCap === Infinity ? null : seatCap,
    });
  }
  const insertedId = Number(ins.rows[0].id);

  // If this insert pushed past the paid cap, bump the Stripe quantity to the
  // AUTHORITATIVE post-insert location count (never below the live Stripe
  // quantity, clamped to the ceiling). Setting an absolute target derived from
  // the real count makes concurrent adds converge and a replay a no-op.
  if (seatCap !== Infinity && tenant.stripeSubscriptionId) {
    const count = (await getLocationsForTenant(tenant.id)).length;
    if (count > seatCap) {
      try {
        const liveQty =
          (await getSubscriptionQuantity(tenant.stripeSubscriptionId)) ?? seatCap;
        const target = clampSeatCount(Math.max(liveQty, count));
        const confirmed = await setSubscriptionQuantity(
          tenant.stripeSubscriptionId,
          target,
        );
        await setTenantPaidLocations(tenant.id, confirmed);
        seatCap = confirmed;
      } catch (err) {
        // The charge failed after insert — roll the location back so we never
        // serve an unpaid location, and surface the failure.
        await db.execute({
          sql: `DELETE FROM locations WHERE id = ? AND tenant_id = ?`,
          args: [insertedId, tenant.id],
        });
        return NextResponse.json(
          {
            error: "seat_charge_failed",
            message: err instanceof Error ? err.message : "Couldn't add a seat.",
          },
          { status: 502 },
        );
      }
    }
  }

  return NextResponse.json({
    location: {
      id: insertedId,
      name,
      address: resolvedAddress,
      latitude,
      longitude,
      radiusMiles,
    },
    unlimited: seatCap === Infinity,
    paidLocations: seatCap === Infinity ? null : seatCap,
  });
}
