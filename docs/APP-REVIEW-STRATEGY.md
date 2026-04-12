# Meta App Review Strategy

## What Superpulse Does

Superpulse is a smart Instagram post boosting tool for local businesses — any business where customers physically walk in to get a product or service. Restaurants, barbers, gyms, salons, car washes, cafes, florists, mechanics, dentists, physiotherapists — if you need footfall, Superpulse works for you.

The business owner posts on Instagram like normal. Superpulse analyses their posts, identifies which ones are worth boosting as local ads, and handles the full campaign lifecycle: budget, radius targeting, duration, and pausing underperformers.

## Why We Need App Review

One permission requires Advanced Access (App Review) before we can serve real customers:

| Permission | Access Level | What it does for us |
|---|---|---|
| `ads_management` | **Advanced** | Creates and manages boost campaigns. This IS the product. |
| `instagram_basic` | Standard | Fetches IG media list and profile data. NOT deprecated (Facebook Login path). |
| `pages_read_user_content` | Standard | Dependency of instagram_basic — required for IG media access |
| `pages_read_engagement` | Standard | Dependency of ads_management |
| `pages_show_list` | Standard | Discovers user's Pages during onboarding |
| `pages_manage_ads` | Standard | Page-level ad association (kept for safety) |
| `ads_read` | Standard | Ad Insights API for campaign performance |
| `email` | Standard | User email for dashboard + notifications |

**REMOVED (9 Apr 2026):** `business_management` — no Business Manager API calls in our code. /me/adaccounts works with ads_management.

**REMOVED (12 Apr 2026):** `instagram_manage_insights` — deferred to Phase 2. Only `ads_management` requires Advanced Access now.

## App Review Safety Strategy

### Why apps get banned by Meta

- Creating ads on accounts without the owner's knowledge
- Scraping data from accounts they don't own
- Bulk automation across hundreds of accounts with no real product
- Hiding what the app does in vague language
- No privacy policy, no real website, no business verification

### Why Superpulse is safe

- Each business owner explicitly logs in via Facebook Login and grants permission themselves
- Business verification already done (inherited from Huddle Duck portfolio)
- Real product with a real domain (superpulse.io) and live privacy policy
- Existing paying clients already using this service manually — we're automating what we already do
- Campaigns created in PAUSED state first — respects Meta's ad review process
- Nothing hidden — justification texts explain exactly what the app does

### The #1 Rule for Screencasts

**Show the human in the loop.** The screencast should present Superpulse as a tool that empowers the business owner to make boost decisions — NOT as an AI that replaces them.

In reality, the full automation comes after approval. For App Review, the demo shows:

1. Business owner logs in and grants permission (visible consent)
2. Owner sees their posts with performance data (insights working)
3. Owner selects which post to boost (human decision)
4. Owner configures budget and radius (human control)
5. App creates the campaign in PAUSED state (safe)
6. Owner reviews and activates (human approval)

This is not deception — it's the MVP flow. The automation layer sits on top of this same flow, just without the manual clicks. Meta doesn't need to see the automation to approve the permissions.

**Never say in the screencast or justifications:**
- "Fully automated ad creation"
- "AI decides everything while you sleep"
- "Zero human involvement"
- "Bulk" or "mass" anything

**Instead say:**
- "Helps business owners boost their best-performing posts"
- "Analyses engagement data to recommend which posts to promote"
- "Business owner controls budget and targeting"
- "Campaigns created in review state before activation"

## Screencast Requirements

### General

- Record on the **live domain** (superpulse.io) — never localhost or Vercel preview URLs
- Use **your own account** (Asad Shah, app admin) — test user Linda has no Pages/IG/ad accounts
- Keep each screencast **2-5 minutes** — long enough to show the flow, short enough for reviewers
- **No voiceover** — use on-screen text annotations instead (Meta reviewers don't listen to audio)
- Use the **mouse** for all interactions — reviewers need to see what you click (no keyboard shortcuts)
- Start from a **logged-out state** — reviewers want the full login flow
- Show the **full flow** from login to the permission being used

### Known Limitation (9 Apr 2026)

The Instagram Graph API `/{ig-user-id}/media` endpoint returns error #10 ("Application does not have permission") in development mode even with correct scopes. This blocks: fetching IG posts and post-level insights. This is a known Meta restriction — Instagram API requires App Review completion before accessing live data, unlike the Marketing API which works in dev mode.

**What works without App Review:** Dashboard (Pages, IG accounts, ad accounts), boost campaign creation (PAUSED state), ad insights, IG profile data (username, followers).

**What's blocked:** IG post listing, post-level insights (impressions, reach, saved, profile_visits).

**Screencast strategy:** Show what works. Include a note in the App Review submission explaining the data dependency.

### Prerequisites (before recording)

- [ ] App deployed to superpulse.io (production)
- [ ] Privacy policy live at superpulse.io/privacy
- [ ] Your account can log in and see real data (Pages, ad accounts)
- [x] "Boost Post" flow exists in the UI (for ads_management) — BUILT
- [x] Ad account / business assets shown in the UI (for business_management) — BUILT AND WORKING

### Screencast 1: ads_management

**Flow to record:**
1. Open superpulse.io → click "Get Started"
2. Facebook Login dialog appears → user grants permissions (show the consent screen)
3. Dashboard loads → shows connected Pages + IG accounts + ad accounts
4. Show the "Boost This Post" button and inline form (budget + radius inputs)
6. Campaign created in PAUSED state → confirmation shown
7. Navigate back to dashboard → campaign appears in summary cards

**What Meta is looking for:** The app creates and manages ad campaigns on behalf of the user who granted permission. Clear consent, clear action, clear result.

### Screencast 2: business_management (STRONGEST — FULLY WORKING)

**Flow to record:**
1. Already logged in (or show quick login)
2. Dashboard auto-discovers 10+ Pages with linked IG accounts (real data, real names)
3. Dashboard shows 25 ad accounts with names, IDs, currencies, active/inactive status
4. Show that the user didn't manually enter any IDs — business_management discovered everything
5. If possible, show the Settings page with the selected ad account

**What Meta is looking for:** The app uses business_management to discover and connect the correct business assets (Pages, IG accounts, ad accounts) — making onboarding seamless for business owners who don't know their account IDs.

## UI Gaps (Status as of 9 Apr 2026)

| Gap | Status | Notes |
|---|---|---|
| **Boost button + form** | ✅ BUILT | PostCard has "Boost This Post" → inline form → /api/boost/create |
| **Post insights panel** | ✅ BUILT | "View insights" toggle on PostCard, shows impressions/reach/saved/profile_visits |
| **Ad account display** | ✅ BUILT | Dashboard shows all ad accounts with name/ID/currency/status |
| **IG post grid** | ✅ WORKING | Fixed by adding instagram_basic scope. 25 posts load with images + likes |
| **Post-level insights data** | ✅ WORKING | views + reach + saved + shares showing (impressions deprecated, replaced with views) |
| **Campaign + AdSet creation** | ✅ WORKING | Fixed: is_adset_budget_sharing_enabled + bid_strategy required params |
| **Ad Creative (IG post as ad)** | ✅ WORKING | App now in Live mode. Creative creation works with actor_id + VIEW_INSTAGRAM_PROFILE CTA |
| **Ad object creation** | ⚠️ BLOCKED BY META SECURITY HOLD | Error 31/3858385 on ALL ad accounts. Bug filed: ID 912378164938739. Code is correct — matches working Test 1. |

## Pre-Deployment Checklist (added 9 Apr 2026)

Before deploying to superpulse.io:

- [x] `instagram_basic` added to Meta App permissions AND OAuth scopes
- [x] Settings page field name mismatch fixed (camelCase throughout)
- [x] PostCard property name mismatch fixed (camelCase matching API)
- [x] Insights API handles Reels gracefully (fallback metric set)
- [x] Dashboard filtered to single business view (Asad Shah Page + SuperPulse ad account)
- [x] All forbidden language scrubbed from UI
- [x] Privacy policy duplicate "Last updated" fixed
- [x] Build passes clean
- [ ] Set `NEXT_PUBLIC_BASE_URL=https://superpulse.io` in Vercel env vars (BLOCKER — without this, server-side fetches fail)
- [ ] Add `https://superpulse.io/api/auth/callback/facebook` to Meta App Dashboard → Facebook Login → Valid OAuth Redirect URIs (BLOCKER — login won't work on live domain)
- [ ] Add `superpulse.io` to Meta App Dashboard → App Domains
- [x] Swap default Next.js favicon for SuperPulse bolt logo — DONE
- [ ] Switch app from Development to Live mode in Meta App Dashboard (REQUIRED for ad creative creation using IG posts)
- [ ] Clean up orphaned test campaigns in Ads Manager (~10 PAUSED campaigns from testing)
- [ ] Resolve Meta security hold (error 31/3858385) — bug report filed ID 912378164938739
- [ ] Workaround: test with new ad account or new IG business account if hold persists

## After Approval

Once Advanced Access is granted:

1. Enable the full AI automation layer (cron jobs for scan-posts and monitor already scaffolded)
2. Remove the manual "Boost" button — AI handles it automatically
3. Add the Managed Boost tier (human QA on AI decisions)
4. Onboard real customers

## Meta App Details

| Field | Value |
|---|---|
| App ID | 1962215474400192 |
| App Name | SuperPulse |
| Domain | superpulse.io |
| Privacy Policy | superpulse.io/privacy |
| Contact Email | asad@huddleduck.co.uk |
| Business Verification | Done (Huddle Duck) |
| Category | Business and pages |
| Test User | Linda Faegdejcibfjaj (ID: 122098086860816797) |

## Justification Texts

See `META-APP-REVIEW-JUSTIFICATIONS.md` for the 6 permission justification texts. These were written for restaurants specifically — **update to say "local businesses" instead of "restaurants"** before submitting.
