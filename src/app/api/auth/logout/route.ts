import { NextRequest, NextResponse } from "next/server";

const COOKIES_TO_CLEAR = ["tenant_id", "fb_access_token"];

function buildLogoutResponse(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  for (const name of COOKIES_TO_CLEAR) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  return buildLogoutResponse(request);
}

export async function POST(request: NextRequest) {
  return buildLogoutResponse(request);
}
