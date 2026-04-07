import { runSchema } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await runSchema();
    return NextResponse.json({ ok: true, message: "Schema initialized" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
