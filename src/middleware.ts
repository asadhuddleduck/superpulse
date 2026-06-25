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
  // Public purchase path (11 Jun 2026): buy → onboard → dashboard without the
  // beta gate. Dashboard + onboarding still enforce their own auth/tenant state.
  "/pricing",
  "/onboarding",
  "/login",
  "/dashboard",
  // HQ join links (25 Jun 2026): a client redeems superpulse.io/join/<token>
  // without the beta gate. The route validates the token itself.
  "/join",
  // Public help/tutorial site (client + internal-team tracks). Sendable without
  // a login; noindex via metadata. On the admin subdomain this path is bounced
  // to the console (admin host is console-only), so guides live on www/apex.
  "/guide",
];

// HQ console surfaces reachable WITHOUT an operator session (login + recovery).
const ADMIN_PUBLIC_PATHS = ["/admin/login", "/admin/forgot", "/admin/reset", "/admin/accept"];

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

// Agency HQ gate (/admin/*). Coarse, edge-safe: it lets login/recovery pages
// through, allows any request carrying an `sp_hq` session cookie (the server
// layout is the authoritative validator), and keeps the legacy ADMIN_DASH_KEY
// gate working for /admin/funnel. Anything else → /admin/login (or 401 for API).
async function adminGate(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // Public HQ surfaces (login + password recovery) and their auth endpoints.
  if (ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin/api/auth/")) return NextResponse.next();

  // Authenticated operator session — coarse presence check; layout validates.
  if (req.cookies.get("sp_hq")?.value) return NextResponse.next();

  // Backward-compat: the legacy single-key gate keeps existing /admin/funnel
  // bookmarks (and the ?key= handoff) working until fully migrated.
  const key = process.env.ADMIN_DASH_KEY;
  if (key) {
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
  }

  // No session: API calls get a clean 401, page loads bounce to the login.
  if (pathname.startsWith("/admin/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

// The internal team console got its own subdomain (25 Jun 2026). admin.superpulse.io
// is console-only: the bare root serves the /admin tree (rewritten so the URL stays
// clean), /admin/* passes through the normal operator gate, and any other path is
// bounced to the console root so the marketing site + client app never surface here.
// The /admin routes also stay reachable on the apex/www host (nothing removed) so
// already-sent invite/accept links keep working.
function isAdminHost(req: NextRequest): boolean {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  return host === "admin.superpulse.io" || host === "admin.localhost";
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isAdminHost(req)) {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(req);
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(req);

  if (isPublicPath(pathname)) return NextResponse.next();

  const password = process.env.SUPERPULSE_GATE_PASSWORD;
  if (!password) {
    // In production, fail CLOSED: a missing gate secret must never silently
    // open the private beta. SUPERPULSE_GATE_PASSWORD is the gate's signing
    // secret (it backs the sp_gate cookie Instagram-login mints) — keep it set.
    // In local dev the secret is normally absent, so fail OPEN there to keep
    // the site walkable without a gate.
    if (process.env.NODE_ENV === "production") {
      console.error("[gate] SUPERPULSE_GATE_PASSWORD not set — refusing access (fail closed)");
      const url = req.nextUrl.clone();
      url.pathname = "/gate";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
    console.warn("[gate] SUPERPULSE_GATE_PASSWORD not set — gate open (dev only)");
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
