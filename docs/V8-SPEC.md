# SuperPulse v8 — Canonical Spec

**Locked:** 2026-05-03 (planning session, this doc)
**Author:** Asad Shah
**Status:** Spec frozen. Engine implementation pending. Launch funnel ships first.
**Supersedes:** v7 conventions in `CLAUDE.md`, `ARCHITECTURE.md`, `STATUS-PANEL.md`, and the open-questions list in Notion task `35584fd7bc4e81d48805e70695d3fc3e`.

---

## TL;DR

SuperPulse v8 is a single-objective, single-CTA, Reels-only auto-boost engine for local businesses. **One Meta campaign per tenant, named "SuperPulse"**, with **N ad sets (one per location)**, with **every eligible Reel added as an ad to every ad set**. AI tweaks budget allocation across ad sets and auto-pauses underperformers. Customer pays £300/mo. Customer sees a phone-first dashboard with big metrics on top and a terminal-style live feed below the fold.

**Launch ships before the engine.** Week 1 = waitlist + paid audit upsell + IG ad. Week 2-3 = v8 engine builds in parallel and goes live for new sign-ups. Legacy clients (PhatBuns, Burger & Sauce, Boo Burger, Henny's, Drip Chicken, Halal Editions) **do not migrate** — they stay on manual-SuperPulse-by-name at £297/mo grandfathered.

---

## Decisions locked (non-negotiable)

### Product
1. **Single objective forever:** `PROFILE_VISITS`. No REACH, no LEAD_GENERATION, no WhatsApp clicks. KPI = profile visits.
2. **Single CTA forever:** "Visit Profile" on every ad. Drives traffic to the IG profile.
3. **Reels only.** No photos, no carousels. v8 filters `media_product_type='REELS'` at the eligibility gate.
4. **One campaign per tenant**, flat. Named just `SuperPulse` (not `SuperPulse v8 | <caption>`) so it lives naturally alongside any other campaigns the tenant runs.
5. **Locations = ad sets.** N ad sets per campaign, one per `locations` row.
6. **Every eligible Reel added to every ad set.** Same ad creative across locations.
7. **AI tweaks budgets + auto-pauses underperformers.** AI does NOT pick which posts to boost — every Reel that passes eligibility gets added.
8. **Stop conditions are codified, not client-configurable.** Auto-managed.
9. **3× spread guardrail:** highest-spending ad set ≤ 3× lowest-spending ad set. Layered over Meta CBO.

### Pricing
10. **£300/mo + VAT** flat for new public sign-ups. No tiers. `FIRSTMONTHFREE` Stripe coupon zeroes month 1.
11. **Legacy clients grandfathered** at £297/mo unlimited locations + Managed Boost. Six tenants. Never advertised. Never re-priced.
12. **Per-location pricing slot reserved** in `tenant_settings.locations_count × per_location_p` — wired but disabled at launch.

### Launch funnel (week 1)
13. **Waitlist landing page** at `superpulse.io/waitlist` (or new variant). Captures email + IG handle + phone + locations + monthly ad budget.
14. **Paid audit upsell** at `/waitlist/audit`. **Shipped 7 May 2026 with simplified two-tier pricing** (the original £19 / +£50 / +£250 spec below was superseded; see CLAUDE.md §Waitlist Funnel for the live config):
    - **£27** — IG profile audit, hand-reviewed by the team, PDF delivered in <24h.
    - **+£97 post-purchase upsell** — 5-7 min personal Loom walkthrough recorded by the team. £97 charged on top of the £27.
    - Original spec retained below for context but no longer authoritative:
      - £19 — AI-assisted IG audit, human-reviewed, PDF delivered in <24h. Hybrid AI+human fulfillment day 1; transition to full-AI later.
      - +£50 order-bump — 5-7 min human Loom video walking through the audit findings.
      - +£250 post-purchase upsell — 1:1 strategy call 7 days later, results review + action plan.
    - All bundle: free priority access to SuperPulse + free human onboarding (£300 value) when SaaS opens to them.
15. **IG audit data via Apify, not Meta API.** Avoids new Meta App Review for a different use case. Apify IG profile scraper costs ~$0.20–$0.50/scrape. Audit runs against public profile data only — no token, no scope.
16. **IG ad creative** drives traffic to the waitlist. Production deferred to a separate marketing task — out of v8 spec scope.

### Engine (week 2-3)
17. **Three crons** (do NOT bundle into one fat cron):
    - `/api/cron/v8/scan` — every 60 min — pulls IG media per tenant, upserts `ig_posts`, scores, marks eligible. **No Meta writes.**
    - `/api/cron/v8/decide` — every 6 hours — one Anthropic Haiku call per tenant. Returns budget tilts + stop intents. **No Meta writes** (queues intents).
    - `/api/cron/v8/execute` — every 30 min — drains intent queue. Max 3 Meta mutations / tenant / tick.
18. **`monitor` cron** (existing, retuned) — every 6h — pulls insights, evaluates stop conditions, writes `performance_data`, enqueues STOP intents.
19. **`reconcile` cron** (existing, unchanged) — daily 04:00 UTC — token health, spend rollup, orphan sweep.
20. **`SCAN_POSTS_KILL_SWITCH`** kept as the v8-engine-wide kill switch (rename to `V8_ENGINE_ENABLED` later if cleaner). Refuses to run unless explicitly set.
21. **Per-app circuit breaker** wired before any cron re-enable: if `rate_limit_log` shows X-App-Usage > 50% in any 1h window, halt all v8 ticks for 2h. The hardening pass on 2026-05-02 added the rate-limit capture; v8 turns it from telemetry into action.

### Stop conditions (codified)
22. **Ad-level:** CTR < 0.5% after 1,000 impressions OR cost-per-profile-visit > 25p after £2 spent OR £5 spent with zero profile visits OR age > 60 days → auto-pause.
23. **Adset-level:** all ads paused 72h → pause adset (preserves audit, allows reactivation).
24. **Campaign-level:** any ad-account `status != 1` → pause campaign immediately. Daily budget exhausted by 02:00 UTC for 3 consecutive days → audit alert `budget_too_tight` (do NOT auto-increase).

### Migration
25. **No legacy migration to v8.** All 8 paused campaigns stay paused. Six legacy tenants stay on manual SuperPulse-by-name forever (or until they choose to upgrade).
26. **v8 = new sign-ups only.** First v8 customer goes through the new funnel. Asad's own ad account `act_1059094086326037` is the first soak target.
27. **Meta `ads_management` access — SCALE gate, not a launch gate (corrected 30 Jun 2026).** Earlier text framed this as "rejected/existential"; that conflated two separate Meta systems. (a) **Permission access level** (set by App Review): "Limited" works for users with a role on the app (testers/admins) + accounts we have access to → real clients run NOW at small scale; "Full" is only for the open public. (b) **Marketing API access tier** (rate limits): upgraded by **500+ successful Marketing API calls in 15 days, <15% error rate** — lowered from 1,500 on 4 May 2026 (the feature was renamed "Ads Management Standard Access" → "Marketing API Access Tier"; tiers "Standard"→"Limited", "Advanced"→"Full"). So: launch the first cohort under Limited Access, let usage clear the 500-call bar, earn Full Access for open self-serve. The path to scale runs through launching. See memory `meta-ads-management-not-a-blocker.md`.

### Dashboard
28. **Phone-first.** Most customers will check on their phone in the kitchen / behind the counter.
29. **Above the fold:** big metrics + photo of top boosted post. KPI strip = 4 numbers (£ spent today, posts boosted 7d, profile visits 7d, next decision in mm:ss).
30. **Below the fold:** "Live Feed" box — terminal-style scrolling feed of activity, matrix-style API talk. **No tokens, no campaign IDs, no competitor reveals.** Mix of (a) real `audit_events` rows replayed at staggered visual cadence, (b) LLM-generated narration tagged `ai.reason` filling gaps, (c) honest end-of-loop line "Next cycle in 67 min — monitor cron at 18:00 UTC" with live countdown.
31. **The rule:** theatre is in the *presentation* (timing, colour, cadence) — never in the *content*. Every line traces to a real DB row OR is LLM commentary on real DB state. No invented numbers. Defends against sophisticated-buyer scrutiny.
32. **Marketing claim defensible at scale:** "hundreds of decisions per minute" is mathematically true on multi-location tenants. 100 locations × 100 posts × 3 decision types per post = 30k decisions per cycle. Spread across the day = hundreds/min. Use it.

### Marketing
33. **Headline angle locked:** "ads don't kill your organic reach" / "go viral and run ads simultaneously." Founder's call. Risk noted (Reddit-debunkable, Meta hasn't published the claim) — not addressed.
34. **Truthful claims also in rotation:** "1% of your rent" • "30% cheaper than the in-app Boost button (no Apple fee)" • "the same Marketing API agencies use" • "hundreds of decisions per minute on your behalf."
35. **Never use "AI" language in any surface Meta App Review can see.** Per `superpulse-app-review.md` standing rule. "Local businesses" not "restaurants." Human-in-the-loop framing for screencasts.

### Daily customer engagement (deferred)
36. **Daily WhatsApp/SMS summary** — recommended ("yesterday X profile visits, £Y spent, top post ↓") — deferred to post-launch retention work. Not week 1.

---

## Schema

### New v8 tables (additive — does NOT touch v7 tables)

```sql
CREATE TABLE tenant_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL UNIQUE,            -- one row per tenant, flat
  meta_campaign_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PAUSED',     -- mirrors Meta effective_status
  daily_budget_pennies INTEGER NOT NULL,     -- tenant total; CBO at campaign level
  cbo_enabled INTEGER NOT NULL DEFAULT 1,
  spend_cap_pennies INTEGER,                 -- optional lifetime hard cap
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE location_adsets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_campaign_id INTEGER NOT NULL REFERENCES tenant_campaigns(id),
  location_id INTEGER NOT NULL REFERENCES locations(id),
  meta_adset_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  min_daily_budget_pennies INTEGER,          -- 3× guardrail floor
  max_daily_budget_pennies INTEGER,          -- 3× guardrail ceiling
  current_spend_today_pennies INTEGER DEFAULT 0,
  last_guardrail_write_at TEXT,              -- enforce 24h cooldown on min/max changes
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_campaign_id, location_id)
);

CREATE TABLE reel_ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_adset_id INTEGER NOT NULL REFERENCES location_adsets(id),
  post_id TEXT NOT NULL REFERENCES ig_posts(id),
  meta_ad_id TEXT NOT NULL UNIQUE,
  meta_creative_id TEXT,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  ai_score REAL,                             -- deterministic engagement score
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT,
  retired_reason TEXT,                       -- low_ctr / cpv_ceiling / zero_visits / max_age
  UNIQUE(location_adset_id, post_id)
);

CREATE TABLE ai_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,               -- 'BUDGET_TILT' | 'STOP_AD' | 'NARRATE'
  input_hash TEXT,                           -- prompt cache key
  input_json TEXT,
  output_json TEXT,
  llm_model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_pennies INTEGER,
  narrative TEXT,                            -- human-readable line for the dashboard feed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reel_ads_adset ON reel_ads(location_adset_id, status);
CREATE INDEX idx_location_adsets_campaign ON location_adsets(tenant_campaign_id);
CREATE INDEX idx_ai_decisions_tenant_time ON ai_decisions(tenant_id, created_at DESC);
```

### v7 tables (kept read-only forever)

`active_campaigns`, `boost_decisions`, `monthly_spend` stay in schema. Used for HMRC reconciliation against the £19.07 lifetime spend on the 8 paused legacy campaigns. New code never writes here. Mark with `-- DEPRECATED_V7_2026_05` comment.

---

## AI decision layer

**Caller:** `decide` cron, one Anthropic call per tenant per tick.
**Model:** `claude-haiku-4-5` for routine tick. (Sonnet only for ad-hoc tenant-strategy work, not in v8 launch scope.)

**Input (zod-validated):** tenant snapshot + current campaign state + per-adset 7d spend/CTR/CPM + active ads with profile-visit telemetry + constraints (3× ratio, stop thresholds, min warmup).

**Output (zod-validated, dropped silently if invalid):**
```json
{
  "budget_tilts": [{ "location_id": 7, "tilt": "up|down|neutral", "reason": "..." }],
  "stops": [{ "reel_ad_id": 123, "reason": "..." }],
  "narrative": "one paragraph, plain English, for the dashboard feed"
}
```

**Cost:** ~£0.007/call × 4 calls/day × 220 tenants = **~£143/month at month-12 target.** Negligible.

**Latency rule:** never call LLM inside a Meta-mutation cron tick. `decide` is its own cron, results queued for `execute`.

---

## Audit upsell (`/waitlist/audit`) — mini-product spec

Separate product surface to SuperPulse the SaaS. Same domain, same brand. Lives alongside.

**Funnel:**
1. Waitlist sign-up (free) → confirm page → "Skip the queue" CTA → `/waitlist/audit`
2. £19 Stripe Payment Link (one-time, no subscription)
3. Order-bump checkbox at checkout: **+£50 — Loom walkthrough** (5-7 min human video)
4. Post-purchase upsell page: **+£250 — 1:1 strategy call 7 days later**
5. Bundled (free with any tier): priority access to SuperPulse, free human onboarding when SaaS opens

**Fulfillment (hybrid AI+human, day 1):**
1. Stripe webhook → Slack notification + Notion task in Actions DB tagged "Audit"
2. Apify run launched against `https://www.instagram.com/{ig_handle}/` (public profile + last 50 posts)
3. AI generates draft audit (top-performing post types, engagement velocity vs cohort, posting cadence, profile-visit estimate, 3 specific posts to boost first)
4. Human reviews + edits + adds context → emailed PDF to customer in <24h
5. If +£50 ordered: human records 5-7 min Loom walkthrough → emailed
6. If +£250 ordered: human books 1:1 call for 7 days out via Cal.com link

**No Meta API token usage. No new App Review submission.** Apify scrapes public profile data — same data anyone can see by visiting the IG profile. SuperPulse's existing `ads_management` / `instagram_basic` scopes are NOT touched by the audit product.

**Future:** when token cost lands under £3/audit and human review time becomes the bottleneck, transition to full-AI fulfillment. Skool community variant (£9/mo for unlimited audits) as a possible spin-off product.

---

## What's NOT in scope for v8

These are deliberately deferred to keep v8 launchable:

- Multi-objective campaigns (REACH, LEAD_GENERATION, WhatsApp clicks).
- Photo or carousel boosting.
- Per-location pricing tiers (slot reserved, not active).
- AI picking *which* posts to boost (every eligible Reel gets added, AI only tweaks budget/stops).
- Daily WhatsApp/SMS summary.
- Multi-tier subscription pricing (Starter/Growth/Pro).
- Annual billing.
- Open public self-serve at scale (gated on the Full Access upgrade, earned via the 500-calls/15d usage threshold — see §27). Small-scale self-serve for added testers / accounts we access works now.
- Full-AI audit fulfillment (hybrid is good enough for launch).

---

## Open questions deferred (NOT blockers)

These don't need answers to ship v8 launch funnel + engine:

1. Industry-specific CTR floors (gym vs salon vs cafe) — uniform 0.5% at launch.
2. Reel-specific quality signals (`ig_reels_skip_rate`, `ig_reels_avg_watch_time`) — out of MVP scoring; revisit when accumulated data justifies.
3. Token refresh strategy — `reconcile` cron logs failures only; auto-refresh deferred per existing comment in `reconcile/route.ts:11-19`.
4. OAuth tenant dedupe (IG-Login vs FB-Login spawning two tenants for the same human) — known bug, root cause #3 in INCIDENT-LOG; v8 doesn't fix, just documents.
5. Campaign chunking when location count > 200 (Meta's 250-adset/campaign limit) — no current tenant is close.

---

## Reference files

### Authoritative for v8
- `docs/V8-SPEC.md` — this doc
- `docs/INCIDENT-LOG.md` — 2026-05-03 freeze entry sets the operational context
- `docs/STRIPE-INTEGRATION.md` — single-tier £300/mo wiring (still valid for v8)
- `docs/LOCATION-PARSER.md` — postcodes.io/Nominatim/Haiku stack for location intake (still valid)
- `docs/AD-CONFIG-TWEAKS.md` — placement / multi-advertiser / Advantage+ opt-outs (still apply in v8)
- `docs/MULTI-TENANT-PHASE-1.md` — token encryption + page picker + 5-wide concurrency (still applies)
- `docs/META-APP-REVIEW-JUSTIFICATIONS.md` — review submission texts (still apply)
- `docs/PRIVACY-POLICY.md` — legal (still applies)

### Superseded by v8 spec (still in repo for context, but not authoritative)
- `docs/ARCHITECTURE.md` — v7 architecture. v8 schema + cron flow above replaces relevant sections. ARCHITECTURE.md §11 (Live Ad QA Checklist) still applies.
- `docs/STATUS-PANEL.md` — v7 status panel. v8 dashboard extends this with terminal feed below the fold.
- `docs/ONBOARDING-AUTOMATION.md` — v7 onboarding. Audit upsell is new; rest still applies.
- `CLAUDE.md` — top-of-file freeze note + v8 spec pointer. Body still references v7 conventions; treat V8-SPEC.md as the source of truth where they conflict.

### Archived
- `docs/archive/BUSINESS-PLAN-V1.md` — pre-pivot business plan from agent swarm (24 Mar 2026).
- `docs/archive/API-FEASIBILITY.md` — pre-pivot Meta API feasibility research (24 Mar 2026). Scoring formula superseded.

### Notion paper trail
- Parent task: [SuperPulse v8 planning](https://www.notion.so/35584fd7bc4e81e98e06d26f73923a11)
- Subtask 1: [Redesign SuperPulse's actual process](https://www.notion.so/35584fd7bc4e81d48805e70695d3fc3e) — answered by this spec
- Subtask 2: [Fix SuperPulse campaign defaults — disable Multi-advertiser ads + Essential enhancements + Advantage+ creative enhancements](https://www.notion.so/35584fd7bc4e815097fad68223bfe76a) — code work, separate task

---

## Build order (informational — Asad's week plan is separate)

Roughly:
1. Waitlist + audit checkout + Apify integration + audit fulfillment flow (~4 dev days, week 1)
2. v8 schema migration (additive, behind kill switch) (~half day)
3. v8 cron skeletons (scan / decide / execute) (~3 days)
4. v8 dashboard (phone-first metrics + Live Feed) (~2 days)
5. Per-app circuit breaker wired (~2 hours)
6. Soak on Asad's `act_1059094086326037` for 24h
7. Open SuperPulse SaaS to first new direct sign-up at £300/mo

Asad's actual week plan is owned outside this doc.
