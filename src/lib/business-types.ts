export const BUSINESS_TYPES = [
  "Restaurant, takeaway or cafe",
  "Barbers or hairdressers",
  "Beauty, nails or aesthetics",
  "Dentist or orthodontist",
  "Gym or fitness studio",
  "Optician or other clinic",
  "Other local business",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

const MIN_LOCATIONS = 1;
const MAX_LOCATIONS = 500;

export function clampLocations(value: unknown): { ok: true; value: number } | { ok: false } {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value);
  else return { ok: false };
  if (!Number.isFinite(n)) return { ok: false };
  const i = Math.floor(n);
  if (i < MIN_LOCATIONS || i > MAX_LOCATIONS) return { ok: false };
  return { ok: true, value: i };
}

const UK_PHONE_DIGITS = /^\d{10,15}$/;

export function normalisePhoneUk(raw: string | undefined): { ok: true; e164: string } | { ok: false } {
  if (!raw) return { ok: false };
  let s = raw.replace(/[\s()\-.]/g, "").trim();
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("07") && s.length === 11) s = "44" + s.slice(1);
  else if (s.startsWith("0") && s.length === 11) s = "44" + s.slice(1);
  if (!UK_PHONE_DIGITS.test(s)) return { ok: false };
  if (/^(0+|1+|2+|3+|4+|5+|6+|7+|8+|9+|1234567890)$/.test(s.slice(2))) return { ok: false };
  return { ok: true, e164: s };
}

const IG_HANDLE_RE = /^[a-z0-9._]{1,30}$/;

export function normaliseIgHandle(raw: string | undefined): { ok: true; handle: string } | { ok: false } {
  if (!raw) return { ok: false };
  let s = raw.trim().replace(/^@/, "");
  const urlMatch = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (urlMatch) s = urlMatch[1];
  s = s.toLowerCase();
  if (!IG_HANDLE_RE.test(s)) return { ok: false };
  return { ok: true, handle: s };
}
