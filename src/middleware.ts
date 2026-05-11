import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sp_gate";

const PUBLIC_PATH_PREFIXES = [
  "/waitlist",
  "/privacy",
  "/proposal",
  "/gate",
  "/api/",
  "/_next/",
  "/favicon",
];

const PUBLIC_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

async function expectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`sp-gate-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const password = process.env.SUPERPULSE_GATE_PASSWORD;
  if (!password) {
    // Fail open if env var unset — log so we notice in Vercel logs.
    console.warn("[gate] SUPERPULSE_GATE_PASSWORD not set — gate disabled");
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await expectedToken(password);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|xml|woff|woff2)).*)"],
};
