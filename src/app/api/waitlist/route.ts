import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  password?: string;
  name?: string;
  email?: string;
  phone?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const expected = process.env.WAITLIST_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Server misconfigured" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password || password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Wrong password. Ask at the stand." },
      { status: 401 },
    );
  }

  const hasFormFields =
    body.name !== undefined || body.email !== undefined || body.phone !== undefined;

  if (!hasFormFields) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Phone required" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO waitlist (email, name, phone, source) VALUES (?, ?, ?, ?)`,
    args: [email, name, phone, "nec-2026"],
  });

  return NextResponse.json({ ok: true });
}
