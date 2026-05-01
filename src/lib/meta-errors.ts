/**
 * Classifies a Meta Marketing API error message into a stable post-rejection
 * reason. Driven by `error_subcode` strings extracted from the JSON body that
 * Meta returns inside HTTP errors.
 *
 * Used by scan-posts + boost-create catch blocks to decide whether a failure
 * means "this post is permanently un-boostable" (so we mark it ineligible and
 * stop retrying every cron tick) versus "transient infra problem".
 *
 * The set is deliberately small — only subcodes we've actually seen in
 * production. Add new entries here when new ones surface in api_call_log.
 */

export interface MetaPostRejection {
  /** Stable reason string written into ig_posts.ineligible_reason. */
  reason: string;
  /** True if the error is a permanent product policy rejection (don't retry). */
  permanent: boolean;
}

interface RejectionRule {
  subcode: number;
  reason: string;
  permanent: boolean;
}

const RULES: RejectionRule[] = [
  // "The reel can't be boosted — Reels that use copyrighted music can't be boosted as ads."
  { subcode: 2875030, reason: "copyright_music", permanent: true },
];

/**
 * Inspect a thrown error's message for a known Meta error_subcode. Returns
 * null when the error doesn't match any known rejection — i.e. probably
 * transient and worth retrying next cron cycle.
 */
export function classifyMetaError(err: unknown): MetaPostRejection | null {
  const msg = err instanceof Error ? err.message : String(err);
  for (const rule of RULES) {
    if (msg.includes(`"error_subcode":${rule.subcode}`)) {
      return { reason: rule.reason, permanent: rule.permanent };
    }
  }
  return null;
}
