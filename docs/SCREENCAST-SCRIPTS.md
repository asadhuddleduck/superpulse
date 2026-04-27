# Screencast Recording Scripts

✅ **DONE — submitted 13 Apr 2026.** Final mp4 lives at `~/Downloads/superpulse-ads-management-v1-annotated.mp4` (29 MB, 2:20 length).

The annotation step ended up being done with **ffmpeg drawtext** instead of Loom — text overlays are baked into the mp4 at frame-accurate timestamps so no separate video editor was needed. The script that built it is at `/tmp/annotate-superpulse.py`. Below are the recording instructions and shot list, kept for reference if a future re-record is needed.

---

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
- [x] Asad's Facebook account has no active security restriction (visit `adsmanager.facebook.com` — no red banner)
- [x] `superpulse.io` loads cleanly with all 25 posts and real insights data
- [x] Boost flow works end-to-end on a non-Reel post (verified 10 Apr)
- [x] No forbidden words ("AI", "automated", "auto-boost", "bot", "scrape") visible anywhere in the UI
- [N/A] Dashboard is filtered to one Page + one ad account — superseded; the dashboard now intentionally shows all the user's connected Pages + ad accounts. The screencast is OK with this because the reviewer sees the user's own multi-business assets.

Before submitting (all done 13 Apr):
- [x] Screencast annotated (ffmpeg drawtext, 18 burned-in overlays at frame-accurate timestamps)
- [x] Web Platform configured (Site URL https://www.superpulse.io/, App Domain superpulse.io)
- [x] Submission queue cleaned: 5 unused permissions removed (instagram_content_publish, instagram_business_manage_insights, instagram_manage_insights, business_management, public_profile)
- [x] Screencast uploaded against all 7 permissions that need it
- [x] Justification text pasted for all 8 permissions (instagram_basic, pages_manage_ads, email, pages_show_list, ads_read, pages_read_engagement, ads_management, Ads Management Standard Access)
- [x] Reviewer instructions filled with step-by-step access notes
- [x] Data handling questionnaire completed (Huddle Duck / UK / No / No / None of the above)
- [x] Privacy policy URL set: `https://www.superpulse.io/privacy`
- [x] Contact email set: `asad@huddleduck.co.uk`
- [x] **Submitted** — submission ID `1962215541066852`

## ffmpeg drawtext annotation script

The annotated mp4 was produced with this approach (no Loom needed):

```bash
ffmpeg -i input.mp4 -vf "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='Overlay':fontsize=72:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=24:x=(w-text_w)/2:y=h-220:enable='between(t,0,4)',drawtext=...,..." -c:v libx264 -preset medium -crf 20 -c:a copy -movflags +faststart output.mp4
```

The full Python wrapper with the 18-overlay timeline lives at `scripts/annotate-screencast.py`. To re-render after editing the TIMELINE list, just `python3 scripts/annotate-screencast.py` — it reads `~/Downloads/superpulse-ads-management-v1.mp4` and writes `~/Downloads/superpulse-ads-management-v1-annotated.mp4`.
