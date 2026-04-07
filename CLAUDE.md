# SuperPulse — AI-Powered Instagram Post Boosting for Local Businesses

## Product
SuperPulse automatically boosts Instagram posts for local businesses using AI. The business owner just posts on Instagram — SuperPulse decides what to boost, where (radius targeting), when, how much budget, and when to pause/adjust. 100% automated.

## Core Value Prop
"SuperPulse turns every post you've already made into a local ad that runs forever."

## Proven Results (Manual Service)
- 7p per profile visit (cheapest local advertising measured)
- £2.18 CPM
- 1M+ local impressions/month (PhatBuns, 18 locations)
- Zero churn across 6 clients
- 10/10 NPS (Boo Burger)
- 38 locations served across 3 multi-location chains

## Tech Stack
- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Turso (LibSQL/SQLite cloud)
- **Auth:** Clerk
- **Billing:** Stripe
- **Ads API:** Meta Marketing API v25.0 (facebook-nodejs-business-sdk)
- **Email:** Resend
- **Hosting:** Vercel
- **Referral Engine:** Viral Loops ($35/month)

## Existing Code to Reuse
- `../client-dashboards/src/lib/meta-api.ts` — Meta API wrapper (GET operations, rate limiting, pagination, backoff). Needs POST/PATCH methods added for write operations.
- `../client-dashboards/src/lib/db.ts` — Turso lazy proxy pattern (copy as-is)
- `../client-onboarding/` — Facebook OAuth flow (expand scope from business_management to ads_management + instagram_manage_insights + pages_manage_ads)
- `../landing-page/src/lib/stripe.ts` — Stripe lazy proxy (copy as-is)
- `../attribution-tracker/public/t.js` — Tracking pixel pattern (auto-discovers endpoint from script src)
- `../attribution-tracker/src/lib/meta-capi.ts` — Meta CAPI (parameterize for per-tenant tokens)
- `../duck-emails/` — Email drip sequence patterns (Resend Broadcasts)

## Meta API Permissions Required
- `ads_management` (Advanced Access — requires App Review)
- `ads_read` (Standard)
- `pages_manage_ads` (Standard)
- `pages_read_engagement` (Standard)
- `instagram_manage_insights` (Advanced — replaces deprecated `instagram_basic` since Jan 2025)
- `business_management` (Advanced — previously rejected, needs resubmission)
- `pages_show_list` (Standard — dependency for ads_management and business_management)
- `email` (Standard — user's email for notifications)

**CRITICAL:** `instagram_basic` is DEPRECATED as of Jan 2025. All code must use `instagram_manage_insights` + `pages_read_engagement` instead.

**LOGIN APPROACH:** Facebook Login (NOT Instagram Business Login). Instagram Business Login does not support the Marketing API — you cannot create ad campaigns with IG Business Login tokens. The onboarding OAuth flow must use Facebook Login, requesting all permissions in a single consent screen.

## Client Experience
The client journey is ultra-simple:
1. Client logs in with their Instagram (via Facebook Login OAuth)
2. Dashboard shows: "AI is working, come back in a few hours"
3. Client gets emailed when ready, or just comes back later
4. Behind the scenes: Superpulse checks eligible posts, boosts at basic budget, monitors performance 24/7

### The 9 Decisions Superpulse Automates
What a human does manually to boost ONE post:
1. Open Instagram
2. Find posts to boost
3. Decide to boost it
4. Decide how long
5. Decide how much to spend
6. Decide when to stop
7. Decide targeting (location)
8. Decide radius
9. Boost
Superpulse's AI makes ALL 9 decisions, 24/7, while the client sleeps.

### Key Metrics Monitored
- Thumb stop rate (impressions → 3-second views)
- Cost per click (CPC)
- Cost per profile visit
- Overall spend vs budget

### Main Goal
Instagram profile visits. Hypothesis: local follows → restaurant visits → sales.
Clients see immediately: higher views, more followers, more engagement, profile visit spike.

### 30% Discount Positioning
Boosting via API bypasses Apple's in-app purchase fees (~30%). Clients automatically save vs self-boosting through the Instagram app.

## AI Decision Engine
See `docs/API-FEASIBILITY.md` for the definitive technical assessment (5-agent research, March 2026).

### Revised Scoring Formula (API-validated)
| Factor | Weight | API Status | MVP Approach |
|--------|--------|-----------|--------------|
| Engagement velocity | 30% | PARTIAL (needs polling infra) | MVP: use current totals normalized by age, not true velocity |
| Recency | 20% | YES (timestamp field) | Ship immediately |
| Content type | 10% | YES (media_type + media_product_type) | Ship immediately. Penalize Reels until copyright confirmed. |
| Historical boost performance | 15% | PARTIAL (needs batch processing) | Default 50 (neutral) until data accumulates |
| Audience match | 10% | PARTIAL (raw data only) | Default 50 (neutral). Phase 3: Claude API analysis. |
| Quality signals (NEW) | 15% | YES | skip_rate, avg_watch_time, follows, profile_activity |

### Key Technical Findings
- **No time-series engagement data** — API returns cumulative totals only. Must build polling + snapshot system for velocity.
- **Shares unreliable** — DM shares never exposed. Drop from velocity formula. Use: likes + comments×3 + saves×4.
- **Copyright music: try-and-fail only** — Cannot pre-detect for app-uploaded posts. Create ads in PAUSED state → wait for review → activate if clean.
- **`instagram_basic` is DEPRECATED** (Jan 2025) — Use `instagram_manage_insights` instead.
- **New signals available (Dec 2025):** `ig_reels_skip_rate`, `ig_reels_avg_watch_time`, `reposts`, `profile_visits` per ad.
- **Rate limits OK:** ~13% of 200 calls/hr budget at peak. Not a bottleneck.

### Decision Loop
- Every 2 hours: scan for new posts via `GET /{ig-user-id}/media`
- Every 6 hours: monitor active boost performance
- Daily: reconciliation batch (archive performance data, update baselines, refresh tokens)

### 7 Decision Types
BOOST, DON'T_BOOST, INCREASE_BUDGET, DECREASE_BUDGET, PAUSE, EXPAND_RADIUS, REDUCE_RADIUS

### Pre-Boost Flow (Revised)
1. Score the post using formula above
2. Check `boost_eligibility_info` field
3. Create Campaign > AdSet > Ad in **PAUSED** state
4. Wait for Meta ad review (poll `ad_review_feedback` every 5 min for first hour)
5. If approved: activate. If rejected (copyright/policy): mark post non-boostable, try next.

### MVP Build Priority
1. Recency + Content Type (trivial, ship day 1)
2. Basic engagement (likes + comments + saves, normalized by age — no polling needed)
3. Boost eligibility check (single field)
4. Try-and-fail copyright handling (PAUSED → review → activate)
5. Quality signals (skip_rate, watch_time — Phase 2)
6. Engagement velocity with polling (Phase 2)
7. Historical performance from accumulated data (Phase 2)
8. Audience match via Claude API (Phase 3)

## Pricing
| Tier | Price | Includes |
|------|-------|----------|
| Starter | £49/month | 1 location, basic AI auto-boost, weekly email report |
| Growth | £99/month | 1 location, full AI + advanced targeting + dashboard |
| Pro | £199/month | 1 location, premium AI + priority support |
| + Managed Boost | +£100/month | Human QA on AI decisions — daily check, tweak if needed, monthly Loom review |
| + Location | +£29/location/month | Per additional location (Growth, Pro, or Managed Boost) |
| Annual | 2 months free | 16.7% discount |
| Trial | 14 days free | No credit card required |

**Pro + Managed Boost = £299/month** — the premium tier for businesses that want AI power with human quality assurance.

### Managed Boost Add-On — What It Is
A daily human QA step on the AI's boost decisions. Does NOT slow things down. Akmal reviews the AI's queue each morning, vetoes weak content, favours business priorities, and makes judgment calls on edge cases (borderline copyright, content quality). Includes a monthly Loom performance review. Capacity: 20-25 clients per person before needing a hire.

### Legacy Clients (Boardroom Decision — 24 March 2026)
Existing clients are grandfathered at **£297/month with unlimited locations and Managed Boost included**.

| Client | Locations | Legacy Price | Equivalent New Price | Savings |
|--------|-----------|-------------|---------------------|---------|
| PhatBuns | 18 | £297/month | £299 + 17×£29 = £792 | £495/month (£5,940/year) |
| Burger & Sauce | 20 | £297/month | £299 + 19×£29 = £850 | £553/month (£6,636/year) |
| Boo Burger | 3 | £297/month | £299 + 2×£29 = £357 | £60/month |
| Henny's Chicken | 1 | £297/month | £299 | £2/month |
| Drip Chicken | 1 | £297/month | £299 | £2/month |
| Halal Editions | 1 | £297/month | £299 | £2/month |

**Rules:**
- Legacy clients KEEP unlimited locations and Managed Boost at £297 forever
- If they downgrade to a self-serve tier, they lose the legacy rate permanently
- Legacy deals are never discussed publicly or in marketing
- If a new prospect asks about legacy pricing: "Early partners got early-partner pricing. The product has changed significantly since then."
- Renegotiation point: revisit legacy deals at 50+ paying SaaS customers or major platform upgrade

## Database Schema (Core Tables)
- `tenants` — id, name, domain, stripe_customer_id, stripe_subscription_id, plan, meta_pixel_id, meta_access_token (encrypted), meta_ad_account_id, pixel_key, allowed_origins, status
- `users` — id, tenant_id, email, name, role
- `locations` — id, tenant_id, name, address, latitude, longitude, radius_miles
- `ig_posts` — id, tenant_id, ig_media_id, content_type, caption, boost_score, boost_eligible, copyright_music, created_at
- `boost_decisions` — id, tenant_id, ig_post_id, location_id, decision_type, score, reason, created_at
- `active_campaigns` — id, tenant_id, ig_post_id, meta_campaign_id, meta_adset_id, meta_ad_id, status, daily_budget, radius_miles, created_at
- `performance_data` — id, campaign_id, date, impressions, reach, clicks, spend, profile_visits, cpm, cpc
- `monthly_spend` — id, tenant_id, month, total_spend, total_impressions, total_profile_visits

## GTM Strategy: Cluster Bomb
Target geographic clusters sequentially:
1. Sparkhill/Stratford Road, Birmingham (50+ restaurants)
2. Moseley/Kings Heath, Birmingham (30+ independents)
3. Ladypool Road, Birmingham (40+ restaurants)
4. Rusholme (Curry Mile), Manchester (40+ restaurants)
5. Brick Lane, London (30+ restaurants)

Per cluster: seed 5 free businesses → harvest 15-20 paying through competitive dynamics.

## Target Customer (Launch)
Ahmed-type: Local restaurant/takeaway owner, 2-5K followers, posts 3-4x/week, £500 marketing budget, nephew does social media. Discovers tools through word of mouth. £49/month Starter tier.

## Key Risks
1. **Meta App Review (EXISTENTIAL)** — Previously rejected. Must submit immediately. Fallback: Instagram Promote API.
2. **Boosterberg ceiling** — $330K ARR after 9 years doing the same thing. SuperPulse MUST evolve beyond just boosting.
3. **Copyright music** — 73% of restaurant Reels have copyrighted music. Try-and-fail pattern required (create PAUSED, wait for review, activate if clean).

## Financial Targets
- Month 3: 50 customers, £6,800 MRR (Founders wave)
- Month 6: 140 customers, £19,000 MRR
- Month 12: 220 customers, £30,000 MRR
- Month 18: 400 customers, £55,000 MRR
- Month 24-28: 770 customers, £100,000 MRR

## Investment
- SEIS angel: £50-100K at £1M pre-money, tranched
- Existing investor: Dr Fuzail Jamall (20% for £21K)
- Targets: SFC Capital (deadline 10 April!), Galvanise Capital, Minerva Birmingham

## Notion References
- Deep Research: "SuperPulse SaaS — Business Plan (Ironman Ultra Final)" in Deep Research DB
- Previous SuperPulse pages: scope of work, coaching notes, V1-V4 versions, client reports
- Decisions DB: multiple SuperPulse decisions logged

## Project Files
- `docs/API-FEASIBILITY.md` — **DEFINITIVE** technical assessment of Meta API capabilities for scoring formula (5-agent research). Read this first for any technical work.
- `docs/BUSINESS-PLAN-V1.md` — First draft business plan from agent swarm
- `docs/ARCHITECTURE.md` — Technical architecture (schema, system flows, build plan). Note: scoring formula in this doc is superseded by API-FEASIBILITY.md.
- `docs/PRIVACY-POLICY.md` — Privacy policy (written, not deployed yet). Will become /privacy route.
- `docs/META-APP-REVIEW-JUSTIFICATIONS.md` — 7 permission justification texts ready to paste into Meta submission form.
- `docs/BRAND-STRATEGY.md` — Brand strategy document
- `docs/BRAND-KIT.md` — Brand kit with colours, typography, usage rules
- `brand/logo-mark.jpg` — **THE master logo** (thick SP-style gold bolt on black). All other brand assets derive from this.
- `research/SPEAKING-CIRCUIT.md` — UK speaking events, strategy, and 90-day calendar

## App Structure (Scaffolded 4 April 2026)
- Next.js 16.2.2 with TypeScript, Tailwind v4, App Router, `src/` directory
- `src/app/page.tsx` — Landing page with "Get Started" button
- `src/app/login/page.tsx` — Facebook Login OAuth page
- `src/app/dashboard/page.tsx` — Protected dashboard (shows user, Pages, linked IG accounts)
- `src/app/privacy/page.tsx` — Privacy policy page (renders docs/PRIVACY-POLICY.md)
- `src/app/api/auth/callback/facebook/route.ts` — OAuth callback (code → short-lived → long-lived token → cookie)
- `src/app/api/auth/logout/route.ts` — Clears token cookie
- `src/lib/auth.ts` — Cookie helpers (httpOnly, secure, sameSite strict, 60-day maxAge)
- `src/lib/facebook.ts` — Facebook Graph API v25.0 helpers (OAuth URL, token exchange, fetch user/pages/IG)
- `src/lib/db.ts` — Turso lazy proxy pattern (not connected yet)

## Meta App (Created 3 April 2026)
- **App Name:** SuperPulse
- **App ID:** 1962215474400192
- **App Secret:** Stored in .env.local only — NEVER commit
- **Contact Email:** asad@huddleduck.co.uk
- **Business Verification:** DONE (inherited from Huddle Duck portfolio)
- **Products:** Facebook Login for Business, Marketing API (both auto-configured on creation)
- **App Icon:** Uploaded (gold SP bolt on black — from brand/logo-mark.jpg)
- **Category:** Business and pages
- **Domain:** superpulse.io (on Cloudflare — zone ID: 462b291abeab6beb2d5373a95f21fec2, NS: cartman.ns.cloudflare.com + jill.ns.cloudflare.com)
- **Permissions configured:** ads_management, ads_read, business_management, instagram_manage_insights, pages_read_engagement, pages_show_list, pages_manage_ads, email — all "Ready for testing"
- **Test user:** Linda Faegdejcibfjaj Alisonberg (ID: 122098086860816797)
- **Initial API calls:** All 7 permissions tested via Graph API Explorer (4 Apr 2026)

## Meta App Review Status
- **Current state:** App created, code scaffolded with OAuth flow. Not submitted.
- **Business Verification:** DONE (inherited from Huddle Duck portfolio)
- **App icon:** DONE (uploaded)
- **Category:** DONE (Business and pages)
- **Privacy policy URL:** NOT DONE (written locally at docs/PRIVACY-POLICY.md, needs deploy to live URL)
- **Permissions needing Advanced Access (App Review):** ads_management, instagram_manage_insights, business_management
- **Blockers:** Deploy app + privacy policy to live URL, record screencast, 1,500 API calls in 15 days
- **Estimated timeline:** 1-2 weeks from deploy to approval
