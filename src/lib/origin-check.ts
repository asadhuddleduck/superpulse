const ALLOWED_HOSTS = [
  "superpulse.io",
  "www.superpulse.io",
  "localhost",
];

function parsedPreviewHosts(): string[] {
  const raw = process.env.ALLOWED_PREVIEW_HOSTS;
  if (!raw) return [];
  return raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function parsedUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isProd(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

function urlAllowed(url: URL | null): boolean {
  if (!url) return false;
  const host = url.host.split(":")[0].toLowerCase();
  if (isProd() && url.protocol !== "https:" && host !== "localhost") return false;
  if (ALLOWED_HOSTS.includes(host)) return true;
  return parsedPreviewHosts().includes(host);
}

export function isAllowedOrigin(headers: Headers): boolean {
  const origin = parsedUrl(headers.get("origin"));
  const referer = parsedUrl(headers.get("referer"));
  if (!origin && !referer) return false;
  if (origin && !urlAllowed(origin)) return false;
  if (referer && !urlAllowed(referer)) return false;
  return true;
}
