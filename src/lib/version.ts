// Single source of truth for the SuperPulse engine/milestone version.
// v9 = private-beta-ready milestone (engine live, paid path fixed) — 26 Jun 2026.
//
// NOTE: this is the INTERNAL version. The client-facing v8 campaign name stays
// exactly "SuperPulse" (no version) by design — see src/lib/v8/provision.ts
// CAMPAIGN_NAME and V8-SPEC §4, so a client's Ads Manager reads cleanly. Use this
// constant for internal naming/logging/version surfaces only.
export const SUPERPULSE_VERSION = "v9";
