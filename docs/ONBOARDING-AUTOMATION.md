# Onboarding Automation — Vision + Architecture

**Authored:** 2026-04-30
**Status:** in progress (3 subtasks scheduled today, 5 follow-ups in backlog)
**Notion parent:** [Onboarding journey polish — first 60 seconds](https://www.notion.so/huddleduck/34e84fd7bc4e81f99413e91bcde28fec)
**Plan file:** `/Users/asadshah/.claude/plans/parallel-exploring-barto.md`

## Vision

**Log in → approve budget → give locations → done.**

After the first 60 seconds the client never has to make another decision. Cron infrastructure runs scoring + auto-boost + monitoring. Email notifications surface key moments. The dashboard shows finger-on-the-pulse status. The 9 boost decisions a human would normally make are made by the AI, 24/7.

## Architecture overview

```
                 ┌─────────────────┐
                 │  /pricing       │  Stripe Checkout — £300/mo + first-month-free promo
                 └────────┬────────┘
                          │ webhook → tenants.subscription_status='active'
                          ▼
                 ┌─────────────────┐
                 │ /onboarding/    │  Facebook Login OAuth
                 │   connect       │  + "Stuck?" → /onboarding/support
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ /onboarding/    │  Multi-page picker (skipped if 1 page)
                 │   select-page   │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ /onboarding/    │  Free-form text → parser → candidates → confirm
                 │   locations     │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ /onboarding/    │  "We're scanning, first boosts ~15 min"
                 │   scanning      │  30s auto-redirect
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ /dashboard      │  StatusPanel hero + recent activity feed
                 └─────────────────┘

   Background:
     scan-posts cron (2h)  → score posts → auto-boost if enabled
     monitor cron (6h)     → flip PAUSED→ACTIVE on Meta review pass, fetch insights
     reconcile cron (4am)  → archive snapshots, refresh tokens
     poll-review cron (5m) → tighten activation window for first hour [follow-up]
     digest cron (Mon 9am) → weekly performance email [follow-up]
```

## Subscription gate (pre-OAuth)

Stripe Checkout sits BEFORE Facebook OAuth. Every Meta token in our DB belongs to a paid customer. App Review quota traffic comes from real, intent-validated users.

### Why pre-OAuth, not post

- Higher-quality App Review traffic (we need 1500 calls / 15d <15% errors).
- Killing tire-kickers reduces token-storage liability.
- Mitigation against the trial-to-paid drop: the `FIRSTMONTHFREE` coupon delivers free first month while still requiring card on file at checkout — empirically converts much better than free trials without cards.

### Cron gate

`src/app/api/cron/scan-posts/route.ts` checks subscription status before processing each tenant:

```ts
if (!['active', 'trialing'].includes(tenant.subscription_status) && !tenant.legacy) {
  result.error = `Subscription not active`;
  return result;
}
```

Six legacy tenants are flagged `legacy=1` and bypass this check.

## Location intake

Web search lookup, NOT Facebook page scraping. Most client socials are dead, and Meta would ban us for scraping their platform.

User pastes free-form text in any format: `"Heavenly Desserts Coventry Road B10 0RX"`, `"Phat Buns 89 stratford rd sparkhill"`, `"Boo Burger Birmingham"`. Parser extracts what it can, looks up candidates, presents disambiguation cards.

Stack:
1. UK postcode regex (free, instant, 100% accurate when present)
2. postcodes.io for postcode → bbox + admin
3. Nominatim structured query within bbox
4. Claude Haiku 4.5 fallback when regex misses or Nominatim returns 0

Cost envelope: <5 Haiku calls expected for 6 legacy clients × 18 locations. Negligible.

Full spec: `docs/LOCATION-PARSER.md`.

## Visibility surface (StatusPanel)

The dashboard becomes a "finger on the pulse" view. Client sees:

- Last scan timestamp + health dot (green/yellow/red based on staleness)
- Posts detected (from `ig_posts`)
- Posts boosted (distinct posts in `active_campaigns`)
- Campaigns live (status='ACTIVE')
- Spend this month (sum from `performance_data`)

Below the hero: recent activity feed reading from a new `audit_events` table. Human-readable rows like "Scanned 47 posts at 14:02", "Boosted post 'Friday wing night' to Sparkhill at 14:32", "Campaign #4521 went live at 14:32".

Polling: SWR-style 30s `setInterval`. No SSE — overkill for the cadence.

Full spec: `docs/STATUS-PANEL.md`.

## Email notifications [follow-up subtask 7]

Resend transactional API (NOT Broadcasts — these are 1-to-1 triggered events). Four templates:

1. `onboardingComplete` — post-OAuth welcome
2. `boostsLaunched` — first PAUSED batch flips ACTIVE
3. `weeklyDigest` — every Monday 9am
4. `failureAlert` — critical unacknowledged `audit_events` row

Pre-flight: verify SPF/DKIM/DMARC on `hello@superpulse.io` Cloudflare DNS.

## Auto-activate tightening [follow-up subtask 8]

Currently campaigns sit PAUSED until the 6h `monitor` cron flips them. Meta usually approves in 5-60 min — 6h is too slow for Friday-night posts.

Plan: new `pending_review_until` column on `active_campaigns` set to `created_at + 1 hour`. Dedicated 5-min cron `/api/cron/poll-review` polls only campaigns inside that window. After the hour expires, falls back to existing 6h `monitor`.

Vercel Hobby caps cron at 100/day. 5-min = 288/day. **Confirm Pro tier before deploying this subtask.**

## Multi-tier roadmap [follow-up subtask 9]

Today: flat £300/mo + VAT. After hitting 20+ paying customers, expand to 3 tiers (Starter / Growth / Pro) + addons (+£100/mo Managed Boost, +£29/mo per Extra Location). Annual toggle 16.7% off.

Migration path for existing £300 flat-tier customers: grandfather at current price, or move up/down to nearest new tier. Decision deferred until we have signal on willingness-to-pay.

## Permanent Meta rejection handling (added 2026-05-01)

Meta's `boost_eligibility_info` pre-check is unreliable — it returns
`eligible: true` for posts that `createAdCreative` later rejects with
`error_subcode: 2875030` (copyright music in a Reel). The first 24h soak on
prod showed all errors were a single bad post being retried every 2h cron
tick, with orphan PAUSED campaigns piling up under `act_1059094086326037`.

### Fix shipped

- New module `src/lib/meta-errors.ts` exports `classifyMetaError(err)` →
  `{ reason, permanent } | null`. Inspects the thrown error message for
  known Meta `error_subcode` values. The list is intentionally small — only
  subcodes we have actually seen in production. Add new rules as they
  surface in `api_call_log`.
- `src/lib/facebook.ts` exports `deleteCampaign(metaCampaignId, token)` —
  hard-deletes a campaign on Meta. Best-effort, swallows failures.
- The catch blocks in `src/app/api/cron/scan-posts/route.ts` and
  `src/app/api/boost/create/route.ts`:
  1. Log the failure to `api_call_log` (unchanged).
  2. Best-effort delete the orphan campaign Meta already accepted before the
     failure point.
  3. If `classifyMetaError` returns `permanent: true`, call
     `markPostIneligible(postId, reason)` so the cron stops retrying.
  4. Write a `review_failed` audit_event so the dashboard recent-activity
     feed surfaces the rejection visibly.
  5. (cron only) Move on to the next-highest-scoring post in the same tick
     instead of stopping outright — the `for…break` was replaced with a
     `postRejected` flag + `continue`.

### Verification

After the fix lands, re-run the soak SQL on `api_call_log` — error_pct
should drop to near 0%. Pull live insights via `GET /act_.../campaigns?effective_status=["PAUSED"]`
to confirm orphan count stops growing.

## App Review traffic plan [follow-up subtask 11]

Current Meta App Review state (23 Apr 2026): 7/8 perms approved. Standard Access Feature **rejected**. Need 1500 calls / 15 days with <15% error rate to re-approve.

Plan: onboard 6 legacy clients via Stripe Checkout (FIRSTMONTHFREE coupon zeroes first month). At 2h scan cadence × 6 tenants × ~50 posts each, we clear 3600 calls / 15d easily. Watch error rate via `audit_events`. Resubmit when threshold hit.

## Files at a glance

| Concern | File(s) |
|---|---|
| Status panel | `src/components/StatusPanel.tsx`, `src/app/api/status/route.ts` |
| Audit log | `src/lib/queries/audit-events.ts` (TBD), schema additions in `src/lib/schema.sql` |
| Location parser | `src/lib/location-parser.ts`, `src/lib/places-lookup.ts`, `src/lib/anthropic.ts`, `src/app/api/locations/parse/route.ts`, `src/components/LocationIntake.tsx` |
| Stripe | `src/lib/stripe.ts`, `src/app/pricing/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/webhook/stripe/route.ts` |
| Flow gate | `src/app/dashboard/layout.tsx` redirect logic |
| Onboarding screens | `src/app/onboarding/connect/page.tsx`, `src/app/onboarding/select-page/page.tsx`, `src/app/onboarding/locations/page.tsx`, `src/app/onboarding/scanning/page.tsx`, `src/app/onboarding/support/page.tsx` |

## Open questions

1. SPF/DKIM/DMARC for `hello@superpulse.io` — configured?
2. Vercel tier — Hobby or Pro? Subtask 8 needs Pro.
3. Multi-tier price points (subtask 9) — TBD when we hit 20+ customers.
4. Onboarding scanning interstitial — keep 30s auto-redirect or wait for actual first boost?
5. Power-user override on PostCard — keep modal default-visible or hide behind "Customize"?
