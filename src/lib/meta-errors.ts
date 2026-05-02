/**
 * Classifies a Meta Marketing API error into a stable post-rejection reason.
 *
 * Two layers:
 *   1. Subcode rules — exact `error_subcode` matches (most precise).
 *   2. Message-pattern rules — regex against `error_user_msg` and the raw
 *      message string. Catches whole CLASSES of bug (e.g. ANY field Meta
 *      deprecates in future) without us having to ship a new subcode each time.
 *
 * Used by scan-posts + boost-create catch blocks to decide whether a failure
 * means "this post is permanently un-boostable / this config is permanently
 * broken — stop retrying" versus "transient infra problem".
 *
 * Add new subcode rules here when new ones surface in api_call_log. The regex
 * rules below are deliberately broad-but-safe — they only fire on phrases
 * Meta's own error_user_msg uses for permanent rejections.
 */

export interface MetaPostRejection {
  /** Stable reason string written into ig_posts.ineligible_reason. */
  reason: string;
  /** True if the error is a permanent product policy rejection (don't retry). */
  permanent: boolean;
}

interface SubcodeRule {
  kind: "subcode";
  subcode: number;
  reason: string;
  permanent: boolean;
}

interface MessageRule {
  kind: "message";
  pattern: RegExp;
  reason: string;
  permanent: boolean;
}

type RejectionRule = SubcodeRule | MessageRule;

const RULES: RejectionRule[] = [
  // "The reel can't be boosted — Reels that use copyrighted music can't be boosted as ads."
  { kind: "subcode", subcode: 2875030, reason: "copyright_music", permanent: true },

  // 2026-05-01: Meta deprecated `creative_features_spec.standard_enhancements`
  // bundled key. Subcode 3858504. Held us in a 3-day retry storm because the
  // classifier only had ONE rule. This entry plus the regex below makes the
  // class-of-bug recurrence-safe — any future deprecation should match the
  // regex even if Meta picks a new subcode.
  { kind: "subcode", subcode: 3858504, reason: "standard_enhancements_deprecated", permanent: true },

  // Generic "Meta deprecated this field" rule. Phrases observed in production:
  //   "standard enhancements field in creative has been deprecated"
  //   "X is deprecated"
  //   "X is no longer supported"
  // Treat as permanent so we stop retrying. The fix is a code change, never
  // something the next cron tick will succeed at.
  {
    kind: "message",
    pattern: /has been deprecated|is deprecated|no longer supported/i,
    reason: "deprecated_field",
    permanent: true,
  },
];

/**
 * Inspect a thrown error's message for a known Meta rejection. Returns null
 * when nothing matches — i.e. probably transient and worth retrying next cycle.
 *
 * Tests against three surfaces:
 *   - the raw error message (covers `"error_subcode":NNNN` substring matches)
 *   - the parsed `error_user_msg` field (Meta's user-facing copy)
 *   - the parsed `message` field (developer-facing copy)
 *
 * The two parsed fields are best-effort — if the body isn't JSON, fall back to
 * the raw string. Either way the regex sees Meta's text somewhere.
 */
export function classifyMetaError(err: unknown): MetaPostRejection | null {
  const raw = err instanceof Error ? err.message : String(err);

  // Try to lift the parsed error_user_msg + message out of Meta's JSON body if
  // it's embedded in the thrown error string.
  let userMsg = "";
  let devMsg = "";
  const jsonStart = raw.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const errBody = parsed?.error ?? parsed;
      userMsg = String(errBody?.error_user_msg ?? "");
      devMsg = String(errBody?.message ?? "");
    } catch {
      // Body wasn't JSON. The regex tier still sees `raw` below.
    }
  }

  const haystack = `${raw}\n${userMsg}\n${devMsg}`;

  for (const rule of RULES) {
    if (rule.kind === "subcode") {
      if (raw.includes(`"error_subcode":${rule.subcode}`)) {
        return { reason: rule.reason, permanent: rule.permanent };
      }
    } else if (rule.pattern.test(haystack)) {
      return { reason: rule.reason, permanent: rule.permanent };
    }
  }
  return null;
}
