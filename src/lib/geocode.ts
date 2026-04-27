/**
 * Address → lat/lng via OpenStreetMap Nominatim (free, no API key).
 *
 * Nominatim usage policy: <= 1 req/sec, must send a real User-Agent identifying
 * the app + contact email. https://operations.osmfoundation.org/policies/nominatim/
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "SuperPulse/1.0 (asad@huddleduck.co.uk)";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (!data.length) return null;
  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
