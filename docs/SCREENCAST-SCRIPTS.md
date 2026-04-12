# Screencast Recording Scripts

One screencast for Meta App Review submission. Record on the live domain `https://www.superpulse.io`, using Asad Shah's account (not the test user — Linda has no real assets to display).

## Recording Setup (do this once before recording)

1. **Browser:** Safari, fresh window, no extensions visible
2. **Resolution:** 1440 × 900 minimum (full-screen the browser)
3. **Tool:** macOS built-in screen recording (Cmd+Shift+5 → "Record Selected Portion") OR Loom desktop app
4. **Audio:** OFF — no voiceover, no system sounds
5. **Mouse:** highlight cursor enabled in System Settings → Accessibility → Display → "Show pointer location" (or Loom's cursor highlight)
6. **Pre-record state:**
   - Log out of `superpulse.io` (visit `/api/auth/logout`)
   - Clear cookies for `facebook.com` so the consent screen shows fresh
   - Close all unrelated tabs
7. **Length target:** 2–4 minutes (long enough to show the flow, short enough that reviewers actually watch)
8. **On-screen text:** add as overlay annotations after recording (Loom or iMovie). Each annotation should stay on screen for at least 3 seconds.

---

## Screencast 1 — `ads_management`

**Goal Meta needs to see:** SuperPulse creates and manages ad campaigns on behalf of a user who explicitly granted permission. Clear consent → clear action → clear result.

**Length target:** 3 minutes

### Shot list

| # | Action | What's on screen | Annotation overlay |
|---|---|---|---|
| 1 | Open Safari, navigate to `https://www.superpulse.io` | Landing page with "Get Started" button | "Local business owner visits SuperPulse" |
| 2 | Click "Get Started" | Login page | "They click Get Started to begin" |
| 3 | Click "Continue with Facebook" | Facebook OAuth consent screen | "Facebook Login flow begins" |
| 4 | Pause on consent screen — show the permissions list | Consent screen with all requested permissions visible | "User reviews exactly what SuperPulse needs access to" |
| 5 | Click "Continue as Asad" / approve | Redirect back to `/dashboard` | "User grants permission" |
| 6 | Dashboard loads — wait for it to fully render | Dashboard showing connected Page, IG account, ad accounts | "SuperPulse now has access to manage campaigns on the user's authorised ad account" |
| 7 | Click "Posts" in the top nav | Posts grid with 25 IG posts and Boost buttons | "The dashboard shows the user's own Instagram posts" |
| 8 | Hover over a post (e.g. "want to work with UK's only…") | Post card visible with engagement counts | "The user reviews their own content" |
| 9 | Click "Boost This Post" | Inline boost form opens with budget + radius inputs | "The user opens the boost form" |
| 10 | Show the form filled with default values (£5/day, 5 miles) | Form visible | "The user sets their budget and local targeting radius" |
| 11 | Click "Create Boost (Paused)" | Loading spinner → success state | "SuperPulse creates the campaign in PAUSED state on the user's ad account" |
| 12 | Wait for success confirmation | "Campaign created" or similar | "Campaign is created paused — the user reviews before activating" |
| 13 | Open a new tab to Ads Manager: `adsmanager.facebook.com` | Ads Manager loaded with the just-created campaign visible | "The campaign now appears in the user's Ads Manager — created by SuperPulse via the API" |
| 14 | Click into the campaign → drill into ad set → drill into ad | Full campaign tree visible with creative thumbnail | "The full campaign hierarchy with the boosted Instagram post as the ad creative" |
| 15 | End recording | — | — |

### Required pre-conditions
- A non-Reel post should be available to boost (carousel or image preferred — avoid copyrighted music)
- The Asad Shah account must NOT currently have a Meta security restriction
- The SuperPulse ad account (`act_1059094086326037`) must be selected by default

### What to AVOID showing
- Multiple ad accounts in the dashboard (filter to one — already filtered in code)
- Any client account names (PhatBuns, Boo Burger, etc.)
- The browser address bar showing localhost or vercel preview URLs
- Any console errors (close DevTools)
- The forbidden words "AI", "automated", "auto-boost" anywhere on screen — verify settings page text and post card text are clean before recording

---

## Submission Notes (paste into the App Review form)

When submitting, in the "Additional notes for reviewer" field, include:

> SuperPulse is built for local business owners (restaurants, salons, gyms, cafes, barbers, mechanics, clinics, and similar walk-in businesses). The screencast demonstrates the full consent and usage flow on the live production domain (www.superpulse.io).
>
> The business owner explicitly grants permission via Facebook Login, then chooses which of their own Instagram posts to boost, sets their own budget and targeting radius, and reviews each campaign before it goes live. All campaigns are created in PAUSED state.
>
> Test account: a Meta test user is configured under the app (Linda Faegdejcibfjaj Alisonberg, ID 122098086860816797), but the screencast uses a real account (Asad Shah, app admin) because the test user has no real Pages, ad accounts, or Instagram Business assets to demonstrate against.

---

## Final pre-submission checklist

Before recording:
- [ ] Asad's Facebook account has no active security restriction (visit `adsmanager.facebook.com` — no red banner)
- [ ] `superpulse.io` loads cleanly with all 25 posts and real insights data
- [ ] Boost flow works end-to-end on a non-Reel post (already verified 10 Apr)
- [ ] No forbidden words ("AI", "automated", "auto-boost", "bot", "scrape") visible anywhere in the UI
- [ ] Dashboard is filtered to one Page + one ad account (no client accounts visible)

Before submitting:
- [ ] Screencast uploaded to App Review form (for ads_management)
- [ ] Justification text from `META-APP-REVIEW-JUSTIFICATIONS.md` pasted into each permission's field
- [ ] Submission notes pasted into the additional-notes field
- [ ] Privacy policy URL set: `https://www.superpulse.io/privacy`
- [ ] Contact email set: `asad@huddleduck.co.uk`
