import { cookies } from "next/headers";

const COOKIE_NAME = "fb_access_token";

/**
 * Set the Facebook access token as an httpOnly cookie.
 * maxAge = 60 days (matches long-lived token expiry).
 */
export async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
}

/**
 * Read the Facebook access token from the cookie.
 * Returns null if not present.
 */
export async function getTokenCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Clear the Facebook access token cookie.
 */
export async function clearTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
