import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, exchangeForLongLivedToken } from "@/lib/facebook";
import { setTokenCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied permissions or something went wrong
  if (error || !code) {
    const errorDescription = searchParams.get("error_description") ?? "Login was cancelled.";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  // Build the redirect URI (must match exactly what was sent to Facebook)
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback/facebook`;

  try {
    // Step 1: Exchange code for short-lived token
    const shortLived = await exchangeCodeForToken(code, redirectUri);

    // Step 2: Exchange short-lived for long-lived token (~60 days)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);

    // Step 3: Store long-lived token in httpOnly cookie
    await setTokenCookie(longLived.access_token);

    // Step 4: Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Authentication failed. Please try again.");
    return NextResponse.redirect(loginUrl);
  }
}
