import { NextRequest, NextResponse } from "next/server";
import {
  HQ_SESSION_COOKIE,
  revokeHqSessionToken,
  clearHqSessionCookie,
  clearImpersonationCookie,
  getHqUser,
} from "@/lib/hq-auth";
import { logHqAction } from "@/lib/hq-audit";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const token = req.cookies.get(HQ_SESSION_COOKIE)?.value;
  const user = await getHqUser();
  await revokeHqSessionToken(token);
  if (user) await logHqAction(user.id, "logout");
  const res = NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.cookies.set(clearHqSessionCookie());
  res.cookies.set(clearImpersonationCookie()); // also drop any active view-as
  return res;
}

export const GET = handle;
export const POST = handle;
