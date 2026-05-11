import { createHmac, timingSafeEqual } from "crypto";

const SECRET_ENV = "WAITLIST_SIGNING_SECRET";
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

type TokenPayload = {
  email: string;
  name: string;
  ig: string;
  iat: number;
};

function getSecret(): string {
  const s = process.env[SECRET_ENV];
  if (!s) {
    throw new Error(`${SECRET_ENV} is not set`);
  }
  return s;
}

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signWaitlistToken(payload: Omit<TokenPayload, "iat">): string {
  const body: TokenPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const bodyB64 = base64url(JSON.stringify(body));
  const sig = createHmac("sha256", getSecret()).update(bodyB64).digest();
  return `${bodyB64}.${base64url(sig)}`;
}

export function verifyWaitlistToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bodyB64, sigB64] = parts;

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = createHmac("sha256", getSecret()).update(bodyB64).digest();
    actual = base64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let body: TokenPayload;
  try {
    body = JSON.parse(base64urlDecode(bodyB64).toString("utf-8")) as TokenPayload;
  } catch {
    return null;
  }
  if (typeof body.iat !== "number") return null;
  if (Math.floor(Date.now() / 1000) - body.iat > TOKEN_TTL_SECONDS) return null;
  return body;
}
