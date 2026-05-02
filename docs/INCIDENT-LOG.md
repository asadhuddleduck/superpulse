# SuperPulse Incident Log

Running record of production incidents, root causes, and runbook patterns. Newest first.

---

## 2026-05-02 — Ad-account picker + runtime status guard shipped

Two preventive shipped on top of the previous incident:

1. **Ad-account picker** (`/onboarding/select-ad-account`). The Facebook OAuth callback no longer auto-binds `adAccounts[0]`. Instead, every new tenant is set to `pending_ad_account` and goes through an explicit picker showing all ACTIVE ad accounts on the user's token, with name + Business Manager + currency. Existing tenants with an `ad_account_id` already set are grandfathered. The picker server-validates the chosen ID against the user's token (anti-tamper) and writes an `audit_events` row on every binding for traceability. Affected files:
   - `src/app/api/auth/callback/facebook/route.ts` — drops `fetchAdAccounts(...)[0]` auto-bind
   - `src/app/api/onboarding/select-page/route.ts` — drops same auto-bind, sets `pending_ad_account` if no existing ad account
   - `src/app/onboarding/select-ad-account/page.tsx` (new)
   - `src/app/onboarding/select-ad-account/select-ad-account-form.tsx` (new)
   - `src/app/api/onboarding/select-ad-account/route.ts` (new)
   - `src/app/dashboard/layout.tsx` — redirect on `pending_ad_account`
   - `src/lib/facebook.ts` — `AdAccount` type now carries `business{id,name}`; `fetchAdAccounts` requests `business` field

2. **Runtime ad-account status guard in `scan-posts` cron.** Before doing any work for a tenant, calls `getAdAccountStatus(adAccountId, token)`. If `account_status !== 1`, the cron skips the tenant and writes an `error`-type `audit_events` row. Stops the closed-account orphan-creation loop (the exact pattern that bit tenant 2 — 12 orphans overnight). One ~50ms Graph call per tenant per tick replaces the 4 doomed Meta calls per failed orphan. Affected files:
   - `src/lib/facebook.ts` — new `getAdAccountStatus` helper
   - `src/app/api/cron/scan-posts/route.ts` — gate at the top of `processTenant`

Outstanding from the original incident (still owed before re-enabling `scan-posts` cron): classifier `/has been deprecated/i` rule, `deleteCampaign` callsite logging, rate-limit header capture, per-post 24h retry cooldown, velocity stagger, boost-flow audit_events.

---

## 2026-05-01 → 2026-05-02 — Standard_enhancements deprecation retry storm + tenant 2 permissions failure

### TL;DR
Meta deprecated the bundled `degrees_of_freedom_spec.creative_features_spec.standard_enhancements` field on 29 Apr ~22:00 UTC. Our `classifyMetaError` only had ONE permanent rule (copyright_music, subcode 2875030) so the deprecation (subcode 3858504) silently fell through to `transient` → cron retried every 2h forever. Each retry left an orphan campaign+adset pair on Meta because `deleteCampaign` is a bare fetch (no `logApiCall`) with double-swallowed errors. Three days later, ~32 orphan PAUSED shells on Meta, ~12 hard-deleted silently (Meta auto-cleaned), zero observability. Fix shipped (commit `2e433ff`) removed the deprecated key. **Tenant 2 (`t_fb_3426122537565919` / `act_277920759052795`) then exposed a separate pre-existing OAuth permissions issue (subcode 1487194) which kept producing orphans on the post-fix cron ticks.** Mitigated by disabling the `scan-posts` cron and soft-disabling tenant 2.

### Severity
**Yellow** — App Review submission ID 1962215541066852 in flight, error rate polluted denominator for Standard Access Feature re-submission. No Meta-side enforcement triggered (account ACTIVE, BUC <1%, app + business clean). 12 ACTIVE legacy campaigns intact throughout.

### Timeline (UTC)

| When | Event |
|---|---|
| 2026-04-25 16:55 | Legacy tenant `t_17841400702538222` created (IG Business Login flow), ad account `act_1059094086326037` |
| 2026-04-29 09:40 | **Second tenant `t_fb_3426122537565919` created via Facebook Login flow** for the same `ig_user_id`. Different ad account `act_277920759052795`. OAuth callback did not dedupe on `ig_user_id`. |
| 2026-04-29 09:53–10:00 | 4 × `subcode 1487194` "Permissions error" on tenant 2's first runs. Cleared without intervention. |
| 2026-04-29 10:08–20:00 | 12 successful boosts on legacy tenant. `active_campaigns` reaches 12 ACTIVE rows. |
| 2026-04-29 ~22:00 | Meta deprecates `standard_enhancements`. Every `createAdCreative` call starts returning HTTP 500 with `error_subcode: 3858504`. |
| 2026-04-29 → 2026-05-01 16:00 | scan-posts cron (every 2h) retries on every tick. 16 deprecation failures + 32 copyright_music retries on dead post `18058050788204553`. Each failure: campaign + adset POSTed (200), creative fails, `deleteCampaign` fires (silent), 38% succeed. Net ~32 orphan PAUSED shells accumulate on Meta. |
| 2026-05-01 14:00–16:00 | User notices "0 boosted, 0 live" on dashboard. Panic — assumed 12 ACTIVE campaigns deleted. Actually a tenant-scoping bug in `/api/status`: dashboard auth'd against the empty `t_fb_*` tenant. |
| 2026-05-01 16:03:32 | Commit `2e433ff` deployed: removed the deprecated key, kept the 8 individual feature opt-outs. |
| 2026-05-01 18:00 → 2026-05-02 04:00 | 6 cron ticks post-deploy. **Deprecation error gone.** But tenant 2 began producing `subcode 1487194` "Permissions error" on every tick — different bug, also at `createAdCreative` step. 12 new orphan campaign+adset pairs accumulated on `act_277920759052795` overnight. |
| 2026-05-02 ~05:00 | **Disabled scan-posts cron** (this commit) + **soft-disabled tenant 2** (UPDATE tenants SET status='disabled' WHERE id='t_fb_3426122537565919') to halt orphan accumulation. |

### Root causes

| # | Cause | File:line | Class |
|---|---|---|---|
| 1 | `classifyMetaError` only handled one permanent rule. The deprecation subcode fell through to null → caught as transient → infinite retry. | `src/lib/meta-errors.ts:27-30` | Class-of-bug. Will recur with EVERY future Meta deprecation. |
| 2 | `deleteCampaign` is bare-fetch with NO `logApiCall` wrapping. Double-swallowed errors. Zero DELETE rows in `api_call_log` lifetime. 38% silent success rate inferred from 64 created vs 44 still on Meta. | `src/lib/facebook.ts:311-324`, `scan-posts:344-350`, `boost-create:241-244` | Observability. Cleanup is partially working blind. |
| 3 | OAuth callback creates a fresh tenant per login flow (Instagram Business Login vs Facebook Login) without deduping on `ig_user_id`. Cron then runs on both → doubled API consumption + doubled orphan creation. | `src/app/api/auth/callback/facebook/route.ts` | Onboarding bug. Real customers will fragment too. |
| 4 | `/api/status` reads from current session's tenant_id cookie. With duplicate tenants, dashboard reads the wrong one and shows 0/0 while the legacy tenant has 12 ACTIVE. | `src/app/api/status/route.ts` | Dashboard scoping. |
| 5 | `api_call_log` is creates-and-reads only. Zero DELETE/PATCH/PAUSE rows ever. Rate-limit headers (`X-App-Usage`, `X-Business-Use-Case-Usage`) never captured. | `src/lib/facebook.ts` (all fetch sites — none log headers) | Observability gap. |
| 6 | No per-post retry backoff. Same dead post (copyright_music) retried 32 times in 3 days. | `src/app/api/cron/scan-posts/route.ts` | Idempotency. Looks like automated junk to Meta integrity. |
| 7 | No boost-flow `audit_events` written. Only `scan_completed` ever logged. Future incidents will be invisible until orphans pile up on Meta. | scan-posts/boost-create catch blocks | Observability. |

### What we did to mitigate (commits)

1. `2e433ff` — Remove deprecated `standard_enhancements` from `creative_features_spec`. Kept 8 individual feature opt-outs. Also fixed mobile dashboard horizontal scroll (break-all on error box).
2. `19053e2` — Disable `scan-posts` cron in `vercel.json` until tenant 2 permissions root cause is fixed and class-of-bug classifier is patched.
3. DB-only — `UPDATE tenants SET status='disabled' WHERE id='t_fb_3426122537565919'`. Stops cron from picking up tenant 2 even if re-enabled. Preserves audit trail.
4. Manual orphan cleanup (PENDING) — open Ads Manager → both ad accounts → filter "SuperPulse v7" + status=PAUSED + 0 ads → archive/delete. Estimated ~32 on `act_1059094086326037`, ~14 on `act_277920759052795`.

### Action items still outstanding

Ordered by impact-per-hour:

1. **Patch `meta-errors.ts` class-of-bug fix** — add a generic `messageMatches: /has been deprecated|is deprecated|no longer supported/i` permanent rule. Otherwise the next Meta deprecation reships this exact incident.
2. **Wrap `deleteCampaign` callsites in `logApiCall`** at `scan-posts:349` and `boost-create:243`. Await `res.ok`. Retry once on transient. ~30 min — fixes the dominant orphan-accrual mechanism + closes the observability gap.
3. **Capture Meta rate-limit headers** (`X-App-Usage`, `X-Business-Use-Case-Usage`) on every response. Persist to `api_call_log` or a new `rate_limit_log` table. ~15 min.
4. **Audit `logApiCall` tenant_id resolution** — db-forensic found ALL 52 boost-flow rows tagged tenant 2 but 42 actually hit tenant 1. Closure variable wrong somewhere. Per-tenant analysis is currently unreliable.
5. **Add per-post 24h retry cooldown** in scan-posts. Skip any (post, location) pair with a 5xx in the last 24h.
6. **Add velocity stagger**: `MAX_LOCATIONS_PER_TENANT_PER_TICK = 3` cap + 500ms inter-call delay in `scan-posts:370`.
7. **Add 4 boost-lifecycle audit_events**: `boost_succeeded`, `boost_failed`, `cleanup_deleted`, `cleanup_failed`.
8. **Fix `/api/status` tenant filter** so dashboard reflects reality.
9. **Fix OAuth callback dedupe** so re-logins re-attach to existing tenant for the same `ig_user_id`.
10. **Roll up adset/ad effective_status** into `active_campaigns.status` (12 nominal vs 2 truly delivering — the activate step only flips campaign status, not adset+ad).
11. **Investigate tenant 2 permissions root cause** — `subcode 1487194` likely means the IG account isn't admin on the page underlying `act_277920759052795`, or the Facebook Login OAuth missed `pages_manage_ads` for that page. Re-do OAuth with explicit page selection, OR delete tenant 2 entirely (it's a dogfood).
12. **Re-enable `scan-posts` cron** once items 1, 2, 3, 5, 6 are shipped. Re-enable at every-6h cadence for the first 48h.

### Detection / how we'd see this earlier next time

What failed:
- `lastError` cleared in `/api/status` even though failures continued under a rolled-up endpoint label, giving false confidence.
- No alerting on cron error rate. 6 consecutive failed ticks went unnoticed overnight.
- Dashboard's "0/0" looked alarming but was a tenant-scoping artifact.

What to add:
- Slack/email alert when `api_call_log` 5xx rate over last 6h exceeds 10%.
- Slack/email alert when scan-posts produces 0 successful adcreatives in any 6h window despite >0 attempts.
- Slack/email alert when `audit_events` records no `boost_succeeded` in 24h.

### Forensic process notes (for the next investigation)

Lessons from running the 4-agent swarm on this:
- **First action on any alarming number must be "verify the number against ground truth"**, not "explain the cause." db-forensic resolved the "12→0" mystery in one SQL query — investigators wasted cycles theorising before that. Single-SELECT `SELECT status, COUNT(*) FROM active_campaigns GROUP BY status` was the highest-value first move.
- **Ground-truth reconciliation early.** The 64 POSTed vs 44 currently-on-Meta gap (= ~20 silent deletes) was discoverable on round 1 if api_call_log POST counts had been cross-referenced against a Graph API list call. We got there in round 4.
- **Code reading must be cross-checked against runtime behavior.** First-pass read of `meta-errors.ts` declared "no permanent classification → no markPostIneligible," which was correct. But the DB-side check (zero ineligible flags being written, despite the catch block existing) was needed to confirm. Trust but verify.
- **Time-relative claims need UTC + source.** "Post-deploy" / "pre-deploy" labels caused a real near-miss when BST/UTC got confused. Always state the absolute UTC timestamp + how it was obtained (`vercel inspect`, `date -u`, etc.).
- **Logged silence ≠ no failure.** `lastError: null` looked clean but rolled-up endpoint labels hid 52 ongoing 500s. Whenever a metric "clears," verify the underlying call volume too.

### Hard numbers (for next-time calibration)

- Days from Meta deprecation to detection: ~3 (29 Apr ~22:00 → 1 May ~16:00)
- Failed `createAdCreative` calls during bug window: 16 (deprecation) + 32 (copyright_music retries) + 4 (OAuth bootstrap) = 52
- Successful Meta orphan creations: 64 campaigns × 64 adsets = 128 paired objects
- Orphans currently sitting on Meta: ~32 PAUSED shells on `act_1059094086326037`, ~14 on `act_277920759052795` (post-overnight accumulation)
- Silent-delete success rate: ~38% (20 of 52)
- API rate-limit utilization observed: <1% (BUC `ads_management`)
- Token health: valid, scopes intact, NOT reissued during App Review window

---
