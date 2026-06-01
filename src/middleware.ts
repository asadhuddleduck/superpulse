import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sp_gate";
const ADMIN_COOKIE = "sp_admin";

const PUBLIC_PATH_PREFIXES = [
  "/waitlist",
  "/privacy",
  "/gate",
  "/api/",
  "/_next/",
  "/favicon",
];

const PUBLIC_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function expectedToken(password: string): Promise<string> {
  return sha256Hex(`sp-gate-v1:${password}`);
}

// Constant-time string compare (edge runtime has no crypto.timingSafeEqual).
function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Internal /admin dashboard: fail CLOSED (no key set = no access), cookie-based,
// with a one-time ?key= handoff that immediately strips the key from the URL and
// stores only a hash in an HttpOnly cookie. Keeps the secret out of the page,
// browser history (after redirect), and Referer headers.
async function adminGate(req: NextRequest): Promise<NextResponse> {
  const key = process.env.ADMIN_DASH_KEY;
  if (!key) return new NextResponse("Not found", { status: 404 }); // fail closed

  const expected = await sha256Hex(`sp-admin-v1:${key}`);
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && ctEqual(cookie, expected)) return NextResponse.next();

  const provided = req.nextUrl.searchParams.get("key");
  if (provided && ctEqual(provided, key)) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(ADMIN_COOKIE, expected, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  return new NextResponse("Not found", { status: 404 });
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(req);

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
