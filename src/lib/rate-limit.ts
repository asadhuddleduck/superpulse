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
  demo: { windowSeconds: 60, maxHits: 3 },
  "audit-offer": { windowSeconds: 60, maxHits: 5 },
  // Agency HQ auth surface — bound online password-spray + reset-bombing on the
  // keys-to-the-kingdom console. 15-min windows.
  "hq-login": { windowSeconds: 900, maxHits: 10 },
  "hq-forgot": { windowSeconds: 900, maxHits: 5 },
  "hq-forgot-email": { windowSeconds: 900, maxHits: 3 },
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function bucketKey(scope: string, id: string, windowSeconds: number): { key: string; windowStart: string } {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds) * windowSeconds;
  return {
    key: `${scope}:${id}`,
    windowStart: new Date(bucket * 1000).toISOString(),
  };
}

let warnedUnknownIp = false;

// `opts.identifier` keys the bucket by an explicit value (e.g. a lowercased
// email) instead of the client IP — call once per-IP and once per-identifier to
// throttle both dimensions (e.g. forgot-password: per-IP + per-email).
export async function checkRateLimit(
  scope: keyof typeof DEFAULTS,
  headers: Headers,
  opts?: { identifier?: string },
): Promise<RateLimitResult> {
  let id: string;
  if (opts?.identifier) {
    id = opts.identifier;
  } else {
    const ip = getClientIp(headers) ?? "unknown";
    if (ip === "unknown") {
      if (!warnedUnknownIp) {
        warnedUnknownIp = true;
        console.warn("[rate-limit] client IP could not be resolved — rate limit bypassed for this request");
      }
      return { ok: true };
    }
    id = ip;
  }

  const cfg = DEFAULTS[scope];
  const { key, windowStart } = bucketKey(scope, id, cfg.windowSeconds);

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
