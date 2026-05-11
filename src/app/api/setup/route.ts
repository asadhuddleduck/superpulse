import { runSchema } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provided = request.headers.get("x-setup-secret") || "";
  const expected = process.env.SETUP_SECRET || process.env.CRON_SECRET || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    await runSchema();
    return NextResponse.json({ ok: true, message: "Schema initialized" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[setup]", message);
    return NextResponse.json({ ok: false, error: "Setup failed" }, { status: 500 });
  }
}
