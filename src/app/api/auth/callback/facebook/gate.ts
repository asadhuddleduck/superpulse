import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchPagesWithIG,
  fetchIGUsername,
} from "@/lib/facebook";
import {
  isAllowed,
  normalizeHandle,
  gateCookieToken,
  safeNext,
  safeBaseUrl,
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
  GATE_OAUTH_COOKIE,
} from "@/lib/ig-gate";

function gateRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/gate", safeBaseUrl(req.headers.get("host")));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.set(GATE_OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

/**
 * Gate branch of the Facebook OAuth callback. Resolves the logged-in account's
 * Instagram @username (across their Pages, incl. the Professional-profile path
 * in fetchPagesWithIG) and gates on SUPERPULSE_GATE_IG_ALLOWLIST. Allowed -> set
 * the shared sp_gate cookie and continue. Not allowed -> bounce to /gate with a
 * denied flag so the page can offer a one-click waitlist join. Never creates a
 * tenant.
 */
export async function handleGateCallback(
  req: NextRequest,
  code: string | null,
  error: string | null,
  state: string,
): Promise<NextResponse> {
  // Verify the CSRF nonce + recover the post-login destination from the cookie.
  const cookieRaw = req.cookies.get(GATE_OAUTH_COOKIE)?.value ?? "";
  const sep = cookieRaw.indexOf("|");
  const expectedNonce = sep >= 0 ? cookieRaw.slice(0, sep) : "";
  const next = safeNext(sep >= 0 ? cookieRaw.slice(sep + 1) : "/");
  const returnedNonce = state.slice("gate:".length);

  if (error || !code) {
    return gateRedirect(req, { next }); // cancelled — back to the gate, no error toast
  }
  if (!expectedNonce || returnedNonce !== expectedNonce) {
    return gateRedirect(req, { next, error: "1" });
  }

  try {
    const redirectUri = `${safeBaseUrl(req.headers.get("host"))}/api/auth/callback/facebook`;
    const shortLived = await exchangeCodeForToken(code, redirectUri);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token).catch(() => shortLived);
    const token = longLived.access_token;

    // Collect every IG username linked to this login (most users have one).
    const pages = await fetchPagesWithIG(token).catch(() => []);
    const igIds = pages
      .map((p) => p.instagram_business_account?.id)
      .filter((id): id is string => Boolean(id));

    const usernames: string[] = [];
    for (const id of igIds) {
      const u = await fetchIGUsername(id, token).catch(() => null);
      if (u) usernames.push(u);
    }

    const matched = usernames.find((u) => isAllowed(u));
    if (!matched) {
      const shown = usernames[0] ? normalizeHandle(usernames[0]) : "";
      return gateRedirect(req, shown ? { next, denied: "1", u: shown } : { next, denied: "1" });
    }

    const cookie = await gateCookieToken();
    const res = NextResponse.redirect(new URL(next, safeBaseUrl(req.headers.get("host"))));
    res.cookies.set(GATE_OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
    if (cookie) {
      res.cookies.set(GATE_COOKIE, cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GATE_COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (err) {
    console.error("[gate] facebook callback error:", err);
    return gateRedirect(req, { next, error: "1" });
  }
}
