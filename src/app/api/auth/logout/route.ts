import { NextRequest, NextResponse } from "next/server";
import { isImpersonating } from "@/lib/hq-auth";

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

// While an operator is viewing-as-client, "Log out" should end the impersonation
// (exit back to HQ), not clobber the operator's own cookies.
async function handle(request: NextRequest): Promise<NextResponse> {
  if (await isImpersonating()) {
    return NextResponse.redirect(new URL("/admin/api/impersonate/stop", request.url));
  }
  return buildLogoutResponse(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
