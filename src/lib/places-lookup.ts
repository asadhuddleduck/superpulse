/**
 * Places lookup: postcodes.io → Nominatim structured query.
 *
 * Both APIs are free with no key. Nominatim usage policy requires a real
 * User-Agent and ~1 req/sec. Postcodes.io has no formal rate limit cliff but
 * we keep it polite.
 */

const POSTCODES_IO = "https://api.postcodes.io/postcodes";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? "SuperPulse/2.0 (asad@huddleduck.co.uk)";

export interface Candidate {
  display: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  postcode: string | null;
  source: "nominatim" | "postcode-centroid";
}

export interface PostcodeInfo {
  postcode: string;
  latitude: number;
  longitude: number;
  district: string;
  ward: string | null;
  region: string | null;
}

interface PostcodesIOResponse {
  status: number;
  result: {
    postcode: string;
    latitude: number;
    longitude: number;
    admin_district: string;
    admin_ward: string | null;
    region: string | null;
  } | null;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
  };
}

/**
 * Look up a UK postcode via postcodes.io. Returns null on any error or
 * non-200/404. Postcodes are space-tolerant — `B100RX` and `B10 0RX` both work.
 */
export async function lookupPostcode(
  postcode: string,
): Promise<PostcodeInfo | null> {
  try {
    const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
    const res = await fetch(`${POSTCODES_IO}/${encodeURIComponent(cleaned)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PostcodesIOResponse;
    if (data.status !== 200 || !data.result) return null;
    return {
      postcode: data.result.postcode,
      latitude: data.result.latitude,
      longitude: data.result.longitude,
      district: data.result.admin_district,
      ward: data.result.admin_ward,
      region: data.result.region,
    };
  } catch {
    return null;
  }
}

/**
 * Search Nominatim for a business near a given lat/lng. Bbox is approximately
 * a 1-mile square centered on the postcode centroid.
 */
export async function searchNearPostcode(
  query: string,
  postcodeInfo: PostcodeInfo,
  limit = 5,
): Promise<Candidate[]> {
  const { latitude, longitude, district } = postcodeInfo;
  const delta = 0.014; // ~1 mile in degrees at UK latitudes
  const viewbox = [
    longitude - delta,
    latitude + delta,
    longitude + delta,
    latitude - delta,
  ].join(",");

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: String(limit),
    addressdetails: "1",
    viewbox,
    bounded: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const items = (await res.json()) as NominatimItem[];
    return items.map((item) => itemToCandidate(item, district));
  } catch {
    return [];
  }
}

/**
 * Wider Nominatim search with no bbox constraint. Used as fallback when we
 * have a biz name but no postcode.
 */
export async function searchOpen(
  query: string,
  limit = 5,
): Promise<Candidate[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: String(limit),
    addressdetails: "1",
    countrycodes: "gb",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const items = (await res.json()) as NominatimItem[];
    return items.map((item) => itemToCandidate(item, null));
  } catch {
    return [];
  }
}

function itemToCandidate(
  item: NominatimItem,
  fallbackCity: string | null,
): Candidate {
  const a = item.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? fallbackCity ?? "";
  const postcode = a.postcode ?? null;
  const name =
    item.name ??
    item.display_name.split(",")[0]?.trim() ??
    "Unknown business";

  const addressParts = [street, city, postcode].filter(Boolean);
  const address = addressParts.join(", ") || item.display_name;

  return {
    display: postcode
      ? `${name} • ${street || city}, ${city || ""} ${postcode}`.trim()
      : `${name} • ${address}`.trim(),
    name,
    address,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    postcode,
    source: "nominatim",
  };
}

/**
 * Last-resort fallback: return the postcode centroid as a single candidate so
 * the user has *something* to confirm rather than a hard fail.
 */
export function postcodeAsCandidate(
  pc: PostcodeInfo,
  bizName: string,
): Candidate {
  return {
    display: `${bizName} • ${pc.district} ${pc.postcode}`,
    name: bizName,
    address: `${pc.district}, ${pc.postcode}`,
    latitude: pc.latitude,
    longitude: pc.longitude,
    postcode: pc.postcode,
    source: "postcode-centroid",
  };
}
