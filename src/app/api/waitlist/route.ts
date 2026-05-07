import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  name?: string;
  email?: string;
  phone?: string;
  locations_count?: number | string;
  instagram_handle?: string;
  business_type?: string;
  source?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseHandle(raw: string): string {
  const t = raw.trim().replace(/^@/, "");
  const m = t.match(/instagram\.com\/([^/?#]+)/i);
  return (m ? m[1] : t).toLowerCase();
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const handleRaw = body.instagram_handle?.trim() ?? "";
  const businessType = body.business_type?.trim() ?? "";
  const source = body.source?.trim() || "public";

  const locationsRaw = body.locations_count;
  const locationsNum =
    typeof locationsRaw === "number"
      ? locationsRaw
      : typeof locationsRaw === "string" && locationsRaw.trim() !== ""
        ? Number(locationsRaw)
        : NaN;
  const locations = Number.isFinite(locationsNum) && locationsNum > 0 ? Math.floor(locationsNum) : null;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
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

  await db.execute({
    sql: `INSERT INTO waitlist (email, name, phone, source, locations_count, instagram_handle, business_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            phone = excluded.phone,
            source = excluded.source,
            locations_count = excluded.locations_count,
            instagram_handle = excluded.instagram_handle,
            business_type = excluded.business_type`,
    args: [email, name, phone, source, locations, handle, businessType || null],
  });

  return NextResponse.json({ ok: true });
}
