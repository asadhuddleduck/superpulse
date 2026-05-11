export function getClientIp(headers: Headers): string | undefined {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return undefined;
}

export function getUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") ?? undefined;
}

export function getCookieValue(headers: Headers, name: string): string | undefined {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;
  for (const pair of cookie.split(";")) {
    const [k, ...rest] = pair.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}
