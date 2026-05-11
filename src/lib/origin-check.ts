const ALLOWED_HOSTS = [
  "superpulse.io",
  "www.superpulse.io",
  "localhost",
];

const ALLOWED_HOST_SUFFIXES = [
  ".vercel.app",
];

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function hostAllowed(host: string | null): boolean {
  if (!host) return false;
  const noPort = host.split(":")[0];
  if (ALLOWED_HOSTS.includes(noPort)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => noPort.endsWith(suffix));
}

export function isAllowedOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const referer = headers.get("referer");
  return hostAllowed(hostOf(origin)) || hostAllowed(hostOf(referer));
}
