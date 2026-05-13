import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string | null {
  const s = process.env.UPSELL_HMAC_SECRET?.trim();
  if (!s || s.length < 16) return null;
  return s;
}

export function issueUpsellToken(sessionId: string): string | null {
  const secret = getSecret();
  if (!secret || !sessionId) return null;
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

export function verifyUpsellToken(sessionId: string, token: string): boolean {
  const expected = issueUpsellToken(sessionId);
  if (!expected || !token) return false;
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}
