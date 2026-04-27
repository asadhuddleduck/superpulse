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

### Prerequisites (all completed as of 12 Apr 2026)

- [x] App deployed to superpulse.io (production) — LIVE
- [x] Privacy policy live at superpulse.io/privacy — LIVE
- [x] App in Live mode (not Development) — DONE
- [x] Account can log in and see real data (Pages, IG, ad accounts) — WORKING
- [x] "Boost Post" flow works end-to-end (campaign + ad set + creative + ad) — VERIFIED 11 Apr
- [x] Meta security hold cleared (error 31/3858385 resolved via Start Authentication) — CLEARED 11 Apr
- [x] Screencast recorded (2:20, ads_management flow) — DONE 12 Apr

### Screencast 1: ads_management

**Flow to record:**
1. Open superpulse.io → click "Get Started"
2. Facebook Login dialog appears → user grants permissions (show the consent screen)
3. Dashboard loads → shows connected Pages + IG accounts + ad accounts
4. Show the "Boost This Post" button and inline form (budget + radius inputs)
6. Campaign created in PAUSED state → confirmation shown
7. Navigate back to dashboard → campaign appears in summary cards

**What Meta is looking for:** The app creates and manages ad campaigns on behalf of the user who granted permission. Clear consent, clear action, clear result.

## Current Status (updated 13 Apr 2026)

✅ **SUBMITTED — In Review** (submitted 13 Apr 2026, submission ID 1962215541066852)

| Feature | Status |
|---|---|
| **Boost button + form** | ✅ WORKING |
| **IG post grid** | ✅ WORKING (25 posts, IG account dropdown selector) |
| **Dashboard (all pages + ad accounts)** | ✅ WORKING |
| **Campaign + AdSet + Creative + Ad creation** | ✅ WORKING (verified 11 Apr) |
| **Meta security hold** | ✅ CLEARED (via Start Authentication 11 Apr) |
| **App mode** | ✅ LIVE |
| **Web Platform configured** | ✅ Site URL https://www.superpulse.io/ + App Domain superpulse.io (added 13 Apr) |
| **Screencast recorded + annotated** | ✅ `~/Downloads/superpulse-ads-management-v1-annotated.mp4` (2:20, 18 burned-in overlays via ffmpeg drawtext) |
| **Submission queue cleaned** | ✅ Removed instagram_content_publish, instagram_business_manage_insights, instagram_manage_insights, business_management, public_profile |
| **All 8 permission justifications** | ✅ Pasted into Meta dashboard |
| **Data handling questionnaire** | ✅ Completed (Huddle Duck / UK / No / No / None) |
| **Reviewer instructions** | ✅ Step-by-step access notes pasted |
| **Post insights panel** | REMOVED (instagram_manage_insights deferred to Phase 2) |

All pre-deployment items from 9 Apr have been completed. The screencast was annotated using ffmpeg `drawtext` instead of Loom — overlays are baked into the mp4, no separate editor needed.

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

See `META-APP-REVIEW-JUSTIFICATIONS.md` for the 8 permission justification texts that were submitted to Meta on 13 Apr 2026. All texts use "local businesses" rather than "restaurants" and emphasise the human-in-the-loop consent flow.
