import { db } from "@/lib/db";
import { getClientIp } from "@/lib/cf-ip";

type LimitConfig = {
  windowSeconds: number;
  maxHits: number;
};

const DEFAULTS: Record<string, LimitConfig> = {
  waitlist: { windowSeconds: 60, maxHits: 10 },
  qualify: { windowSeconds: 60, maxHits: 5 },
  upsell: { windowSeconds: 60, maxHits: 3 },
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function bucketKey(scope: string, ip: string, windowSeconds: number): { key: string; windowStart: string } {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds) * windowSeconds;
  return {
    key: `${scope}:${ip}`,
    windowStart: new Date(bucket * 1000).toISOString(),
  };
}

export async function checkRateLimit(
  scope: keyof typeof DEFAULTS,
  headers: Headers,
): Promise<RateLimitResult> {
  const ip = getClientIp(headers) ?? "unknown";
  if (ip === "unknown") return { ok: true };

  const cfg = DEFAULTS[scope];
  const { key, windowStart } = bucketKey(scope, ip, cfg.windowSeconds);

  try {
    await db.execute({
      sql: `INSERT INTO rate_limit_buckets (bucket_key, window_start, hit_count)
            VALUES (?, ?, 1)
            ON CONFLICT(bucket_key, window_start) DO UPDATE SET hit_count = hit_count + 1`,
      args: [key, windowStart],
    });

    const result = await db.execute({
      sql: `SELECT hit_count FROM rate_limit_buckets WHERE bucket_key = ? AND window_start = ?`,
      args: [key, windowStart],
    });
    const row = result.rows[0] as { hit_count?: number } | undefined;
    const hits = Number(row?.hit_count ?? 0);

    if (hits > cfg.maxHits) {
      const windowEnd = new Date(windowStart).getTime() / 1000 + cfg.windowSeconds;
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - Date.now() / 1000)) };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
