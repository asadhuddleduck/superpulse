import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendCapi } from "@/lib/meta-capi";

export const runtime = "nodejs";

type Body = {
  first_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  instagram_handle?: string;
  source?: string;
  event_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseHandle(raw: string): string {
  const t = raw.trim().replace(/^@/, "");
  const m = t.match(/instagram\.com\/([^/?#]+)/i);
  return (m ? m[1] : t).toLowerCase();
}

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const firstName = (body.first_name || body.name)?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const handleRaw = body.instagram_handle?.trim() ?? "";
  const source = body.source?.trim() || "public";

  if (!firstName) {
    return NextResponse.json({ ok: false, error: "First name required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Phone required" }, { status: 400 });
  }
  if (!handleRaw) {
    return NextResponse.json(
      { ok: false, error: "Instagram handle required" },
      { status: 400 },
    );
  }

  const handle = normaliseHandle(handleRaw);
  const landedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO waitlist
            (email, name, first_name, phone, source, instagram_handle,
             utm_source, utm_medium, utm_campaign, utm_content, utm_term, landed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            first_name = excluded.first_name,
            phone = excluded.phone,
            source = excluded.source,
            instagram_handle = excluded.instagram_handle,
            utm_source = COALESCE(excluded.utm_source, waitlist.utm_source),
            utm_medium = COALESCE(excluded.utm_medium, waitlist.utm_medium),
            utm_campaign = COALESCE(excluded.utm_campaign, waitlist.utm_campaign),
            utm_content = COALESCE(excluded.utm_content, waitlist.utm_content),
            utm_term = COALESCE(excluded.utm_term, waitlist.utm_term)`,
    args: [
      email,
      firstName,
      firstName,
      phone,
      source,
      handle,
      clean(body.utm_source),
      clean(body.utm_medium),
      clean(body.utm_campaign),
      clean(body.utm_content),
      clean(body.utm_term),
      landedAt,
    ],
  });

  const eventId = body.event_id?.trim() || `wl_${Date.now()}_${email}`;
  await sendCapi({
    event_name: "Lead",
    event_id: eventId,
    email,
    phone,
    first_name: firstName,
    source_url: request.headers.get("referer") || undefined,
    client_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    client_user_agent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ ok: true });
}
