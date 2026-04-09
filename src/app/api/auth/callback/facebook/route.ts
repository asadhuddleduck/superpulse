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

    // Step 3: Redirect to dashboard with cookie set on the SAME response object
    // (cookies().set() + NextResponse.redirect() are separate responses — cookie gets lost on Vercel)
    const dashboardUrl = new URL("/dashboard", request.url);
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.set({
      name: "fb_access_token",
      value: longLived.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    });
    return response;
  } catch (err) {
    console.error("Facebook OAuth callback error:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Authentication failed. Please try again.");
    return NextResponse.redirect(loginUrl);
  }
}
