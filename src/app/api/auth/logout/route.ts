import { NextRequest, NextResponse } from "next/server";
import { clearTokenCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await clearTokenCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: NextRequest) {
  await clearTokenCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}
