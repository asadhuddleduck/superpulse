import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// AES-256-GCM token encryption.
// Format: "v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>"
// Versioned so we can rotate the algorithm/key without ambiguity.
const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96 bits — GCM standard

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY env var is required");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  cachedKey = key;
  return key;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(blob: string): string {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`Unrecognised ciphertext format (expected ${VERSION}:iv:tag:ct)`);
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Encrypt only if not already encrypted — idempotent for migration scripts. */
export function ensureEncrypted(value: string | null | undefined): string | null {
  if (!value) return null;
  return isEncrypted(value) ? value : encrypt(value);
}

/** Decrypt only if encrypted — handles unmigrated rows during cutover. */
export function decryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null;
  return isEncrypted(value) ? decrypt(value) : value;
}
