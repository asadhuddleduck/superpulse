import { NextRequest, NextResponse } from "next/server";
import { getTenantCookie } from "@/lib/auth";
import { parseLocationInput, type ParseResult } from "@/lib/location-parser";

export const dynamic = "force-dynamic";

interface RequestBody {
  text?: string;
  texts?: string[];
}

export async function POST(request: NextRequest) {
  const tenantId = await getTenantCookie();
  if (!tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Multi-line path: parse one entry per line, return per-line results.
  if (Array.isArray(body.texts)) {
    const lines = body.texts.map((t) => t.trim()).filter(Boolean);
    if (lines.length === 0) {
      return NextResponse.json({ error: "No locations provided" }, { status: 400 });
    }
    if (lines.length > 25) {
      return NextResponse.json(
        { error: "Maximum 25 locations per batch" },
        { status: 400 },
      );
    }
    const results: ParseResult[] = [];
    for (const line of lines) {
      results.push(await parseLocationInput(line));
    }
    return NextResponse.json({ results });
  }

  // Single-line path.
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const result = await parseLocationInput(text);
  return NextResponse.json(result);
}
