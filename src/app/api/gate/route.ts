import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sp_gate";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function expectedToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`sp-gate-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/gate")) return "/";
  return next;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));

  const expectedPassword = process.env.SUPERPULSE_GATE_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.redirect(new URL(next, req.url), { status: 303 });
  }

  if (password !== expectedPassword) {
    const url = new URL("/gate", req.url);
    url.searchParams.set("next", next);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = await expectedToken(expectedPassword);
  const res = NextResponse.redirect(new URL(next, req.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
