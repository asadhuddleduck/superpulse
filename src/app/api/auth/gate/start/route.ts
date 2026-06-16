import { NextRequest, NextResponse } from "next/server";
import { buildOAuthURL } from "@/lib/facebook";
import {
  safeNext,
  safeBaseUrl,
  GATE_OAUTH_COOKIE,
  GATE_STATE_PREFIX,
} from "@/lib/ig-gate";

// Kicks off the private-beta login. Reuses SuperPulse's own Facebook-Login
// OAuth and its already-registered /api/auth/callback/facebook redirect URI;
// the `gate:` state prefix tells that shared callback to run the gate branch
// (identity + allowlist) instead of creating a tenant. Stores a CSRF nonce +
// post-login destination in a short-lived httpOnly cookie.
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const base = safeBaseUrl(req.headers.get("host"));
  const nonce = crypto.randomUUID();
  const redirectUri = `${base}/api/auth/callback/facebook`;

  const oauthUrl = buildOAuthURL(redirectUri, `${GATE_STATE_PREFIX}${nonce}`);
  const res = NextResponse.redirect(oauthUrl);
  res.cookies.set(GATE_OAUTH_COOKIE, `${nonce}|${next}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 min to complete the round-trip
  });
  return res;
}
