# SuperPulse — AI Scoring Formula: API Feasibility Assessment

**Date:** 24 March 2026
**Research Method:** 5-agent team (3 researchers + 1 advocate + team lead) with high-bandwidth collaboration
**API Version:** Meta Graph API v25.0 / Instagram Graph API with Facebook Login
**Status:** DEFINITIVE — based on actual API documentation research, not speculation

---

## Executive Summary

The SuperPulse AI scoring formula is **feasible but requires significant architectural adaptations**. Of the 5 scoring factors, 1 is fully supported by the API, 1 is mostly supported, and 3 require SuperPulse to build its own infrastructure on top of raw API data.

**The single biggest risk is copyright music on Reels.** 73% of restaurant Reels have copyrighted music that blocks boosting, and the API cannot detect this pre-boost for app-uploaded posts. The system must use a try-and-fail pattern, which fundamentally changes the scoring architecture.

| Factor | Weight | Verdict | Confidence |
|--------|--------|---------|------------|
| Engagement Velocity | 30% | PARTIAL | Medium |
| Recency | 20% | YES | High |
| Content Type | 10% | YES | High |
| Historical Performance | 15% | PARTIAL | Medium |
| Audience Match | 10% | PARTIAL | Low-Medium |
| Quality Signals (NEW) | 15% | YES | High |

**Overall: The formula CAN be built, but the business plan underestimates the infrastructure complexity.** Budget 2-3x more engineering time than naive estimates suggest.

---

## Scoring Factor 1: Engagement Velocity (35% weight)

### Verdict: PARTIAL — Requires polling infrastructure

### What the formula needs
```
ev = (likes + comments*3 + saves*4) / hours_since_posted
ev_score = min(ev / location_avg_ev, 1.0) * 100
# Note: shares dropped — DM shares never exposed via API (see Recommended Adaptation below)
```

### API Data Availability

| Metric | Available? | Endpoint | Field | Permission |
|--------|-----------|----------|-------|------------|
| Likes | YES | `GET /{ig-media-id}?fields=like_count` | `like_count` | `pages_read_engagement` |
| Comments | YES | `GET /{ig-media-id}?fields=comments_count` | `comments_count` | `pages_read_engagement` |
| Shares | PARTIAL | `GET /{ig-media-id}/insights?metric=shares` | `shares` | `instagram_manage_insights` |
| Saves | YES | `GET /{ig-media-id}/insights?metric=saved` | `saved` | `instagram_manage_insights` |
| Timestamp | YES | `GET /{ig-media-id}?fields=timestamp` | `timestamp` (ISO 8601) | `pages_read_engagement` |
| Time-series data | NO | N/A | N/A | N/A |

### Critical Issues

**1. No time-series engagement data.** The API returns ONLY current cumulative totals. There is no endpoint for "likes at time T" or "engagement at 2 hours post-publish." SuperPulse MUST build a polling + snapshot system:

```
Poll flow (per new post):
  T+0:   Detect new post via GET /{ig-user-id}/media (1 call)
  T+20m: Poll engagement metrics (2 calls: media fields + insights)
  T+40m: Poll again (2 calls)
  T+60m: Poll again (2 calls)
  T+80m: Poll again (2 calls)
  T+100m: Poll again (2 calls)
  T+120m: Final poll — calculate velocity (2 calls)
  Total: ~13 API calls per new post over 2 hours
```

**2. Shares are unreliable.** DM shares/sends (arguably the highest-value signal) are NEVER exposed via any API. The `shares` insight metric captures reshares and forwards but NOT DM sends. `repost_count` (added Dec 2025) only covers public reposts to profiles. For the formula, reduce share weight or remove entirely.

**3. Rate limit budget for polling.** At 200 calls/hour/account:
- Velocity polling for 1 new post: ~13 calls over 2 hours = ~7 calls/hour
- 2-3 new posts/day overlapping: ~14-21 calls/hour during active periods
- Account baseline refresh (weekly): ~50 calls, amortised = negligible
- Other features (boost monitoring, insights): ~20-30 calls/hour
- **Total during peak: ~50-60 calls/hour = 25-30% of budget. VIABLE.**

**4. Account baseline must be cached.** Computing "location_avg_ev" requires querying the last ~50 posts. This MUST be pre-computed and stored in Turso (weekly refresh), not calculated on-the-fly. Without caching, baseline computation alone would consume 50 calls per scoring cycle.

### Recommended Adaptation

```
REVISED VELOCITY FORMULA (API-realistic):

ev = (likes + comments*3 + saves*4) / hours_since_posted
                    ^^^
            (drop shares — too unreliable)

Polling interval: every 20 minutes for first 2 hours after post detection
Storage: Turso engagement_snapshots table
Baseline: Cached weekly in Turso per-location
```

### Webhooks
Instagram webhooks do NOT support "new post published" or engagement events. Only: comments on owned media, @mentions, story insights. **Polling is the only option.**

---

## Scoring Factor 2: Recency (20% weight)

### Verdict: YES — Fully feasible

### Formula
```
recency_score = max(0, 100 - (hours_since_posted * 4))
// Linear decay: 100 at 0h, 0 at 25h
```

### API Support

| Need | Available? | Details |
|------|-----------|---------|
| Post creation timestamp | YES | `timestamp` field on media object, ISO 8601 UTC |
| Calculation | Local | `hours_since_posted = (now - timestamp) / 3600` |

### Caveats
- Timestamps are UTC. Consider business timezone for relevance scoring (e.g., a 10pm post in Birmingham is midnight UTC).
- No issues at scale. Timestamp is a basic media field — fetched alongside other fields in a single call.

---

## Scoring Factor 3: Content Type (15% weight)

### Verdict: YES — Fully feasible with one field adjustment

### Formula
```
VIDEO (Reels)    = 80
CAROUSEL         = 70
IMAGE            = 50
```

### API Support

| Need | Available? | Details |
|------|-----------|---------|
| Media type | YES | `media_type` field: `IMAGE`, `VIDEO`, `CAROUSEL_ALBUM` |
| Reel vs regular video | YES | `media_product_type` field: `REELS`, `FEED`, `STORY`, `AD` |

### Critical Correction
The business plan assumes Reels > Carousels > Images. But `media_type` returns `VIDEO` for BOTH regular videos and Reels. **You MUST query `media_product_type` to distinguish Reels from feed videos.**

```
Correct detection:
  media_type=VIDEO + media_product_type=REELS  → Reel (score 80)
  media_type=VIDEO + media_product_type=FEED   → Feed video (score 60?)
  media_type=CAROUSEL_ALBUM                     → Carousel (score 70)
  media_type=IMAGE                              → Image (score 50)
```

### Copyright Caveat (see Pre-Boost Checks section)
Reels score highest but 73% of restaurant Reels have copyrighted music that blocks boosting. The scoring formula should incorporate a "boostability penalty" for Reels with unknown copyright status. See Section 7 below.

---

## Scoring Factor 4: Historical Performance (15% weight)

### Verdict: PARTIAL — Data available, matching is complex

### Formula
```
// Average ROAS of past boosts for this content type at this location
// 0-100 scale, 50 = no history (neutral)
```

### API Support

| Need | Available? | Details |
|------|-----------|---------|
| Boost campaign performance | YES | Marketing API: `GET /act_{id}/insights?fields=spend,impressions,clicks,reach,frequency,cpm,cpc,ctr,actions` |
| Performance per ad | YES | `?level=ad&time_increment=1` for daily breakdown per ad |
| Link ad to organic post | YES | Ad creatives contain `source_instagram_media_id` — reverse-lookup possible |
| Content similarity | PARTIAL | Captions available for NLP. Media URLs available but expire (must cache). |

### What's Already Built
`client-dashboards/src/lib/meta-api.ts` already fetches: `campaign_id, adset_id, adset_name, spend, impressions, clicks, reach, frequency, actions, outbound_clicks, cost_per_action_type`. This code can be reused directly for SuperPulse.

### Critical Issues

**1. Cold start problem.** New customers have zero historical boost data. The 15% weight is meaningless until the customer has been on SuperPulse for weeks. Must default to 50 (neutral) and gradually increase weight as data accumulates.

**2. Reverse-lookup cost.** Finding "which past boosts used similar content" requires iterating ad creatives and matching `source_instagram_media_id` back to organic posts, then grouping by content type and location. This is a batch operation — run during the daily reconciler, not in real-time scoring.

**3. Data retention limits (changed Jan 2026):**
- General insights: 37 months max
- Unique-count fields with breakdowns: 13 months max
- Frequency breakdowns: 6 months max
- **Queries beyond these windows return EMPTY DATA, not errors** (silent failure!)
- SuperPulse MUST archive performance data in Turso proactively.

**4. Prior manual boosts are queryable.** If a customer previously boosted posts manually through the Instagram app, those campaigns ARE visible via the Marketing API (with `ads_read` permission). This gives SuperPulse a head start on historical data even for new customers.

### Recommended Architecture
```
Daily reconciler job:
  1. Fetch all active/completed campaigns from Marketing API
  2. Match each to organic post via source_instagram_media_id
  3. Store performance metrics in Turso: boost_history table
  4. Compute per-content-type, per-location averages
  5. Cache in Turso for real-time scoring lookups
```

---

## Scoring Factor 5: Audience Match (15% weight)

### Verdict: PARTIAL — Raw data available, "match" logic is entirely custom

### Formula
```
// Does the post content match the location's best-performing content?
// Phase 1: always 50 (neutral). Phase 2: Claude API content analysis.
```

### API Support

| Need | Available? | Details |
|------|-----------|---------|
| Follower demographics | YES | `GET /{ig-user-id}/insights?metric=follower_demographics` — age, gender, city, country |
| Audience online times | YES | `online_followers` — hourly breakdown, last 30 days |
| Post caption for NLP | YES | `caption` field on media |
| Post media for vision AI | YES | `media_url` (temporary CDN link, must cache) |
| Paid audience breakdowns | YES | Marketing API: `?breakdowns=age,gender,country` |
| Non-follower reach | NO | Not available via API (only in native IG app) |

### Critical Issues

**1. Demographics limited to top 45 segments** (privacy limit). For a small local restaurant with 500 followers mostly in one city, this is fine. For larger accounts, you lose the long tail.

**2. 48-hour delay on demographic data.** Not real-time. Fine for scoring (demographics don't change daily).

**3. 100-follower minimum.** Accounts with fewer than 100 followers get no demographic data. Some SuperPulse customers (new restaurants) may fall below this.

**4. The "match" is 100% SuperPulse's AI problem.** The API gives raw ingredients (follower demographics + post content). Computing "does this food photo match the preferences of 25-34 year olds in Sparkhill?" requires:
- Content classification (Claude Haiku for caption analysis)
- Visual analysis (Claude Sonnet for food photo recognition)
- Demographic preference modeling (learned from historical boost performance)
- This is the hardest factor to implement well. Phase 1 defaulting to 50 (neutral) is the correct approach.

### Recommended Phased Approach
```
Phase 1 (MVP):     audience_match = 50 (neutral for all posts)
Phase 2 (Month 3): Simple rules — time-of-day matching with online_followers data
Phase 3 (Month 6): Claude API caption analysis + demographic correlation from boost history
Phase 4 (Month 9): Full ML model trained on accumulated boost performance data
```

---

## Pre-Boost Safety Checks

### Check 1: Boost Eligibility
**Verdict: YES — Available**

| Field | Endpoint | Notes |
|-------|----------|-------|
| `boost_eligibility_info` | `GET /{ig-media-id}?fields=boost_eligibility_info` | Returns eligibility status + reason if ineligible |

**Caveat:** Field documentation is sparse. Sub-field structure (exact status values, reason codes) is poorly documented. Needs real API testing to map all possible responses. The field IS confirmed on the official IG Media reference page.

### Check 2: Copyright Music Detection
**Verdict: NO for app-uploaded posts (CRITICAL)**

| Scenario | Available? | Details |
|----------|-----------|---------|
| Posts uploaded via Content Publishing API | YES | `copyright_check_information` field with full match details |
| Posts uploaded via Instagram app | NO | Field not available. Meta docs: "We only support Instagram media created via the content publishing API for early copyright detection." |

**This is the single biggest technical risk for SuperPulse.**

Since 100% of SuperPulse customers upload posts via the Instagram app (not the API), copyright pre-screening is impossible. The only detection method is:

```
TRY-AND-FAIL PATTERN:
  1. Score the post (may rank Reels highly)
  2. Check boost_eligibility_info (catches some issues)
  3. Create Campaign > AdSet > Ad via Marketing API
  4. Wait for ad review (minutes to 24 hours)
  5. Check ad_review_feedback for rejection
  6. If rejected for copyright: mark post as non-boostable, try next post
  7. Communicate to user: "This post couldn't be boosted due to copyrighted music"
```

**Impact:** With 73% of restaurant Reels containing copyrighted music:
- The system will attempt to boost many Reels that ultimately fail
- Each failed attempt consumes Marketing API write calls (3 points each: campaign + adset + ad = 9 points)
- Failed attempts waste time (ad review can take hours)
- User experience suffers if the dashboard shows "boosting..." then switches to "failed"

**Mitigation strategies:**
1. **Learn from failures.** Track which posts failed copyright review. Over time, build a per-account "copyright failure rate by content type" metric. If an account's Reels fail 80%+ of the time, automatically deprioritize Reels.
2. **Penalize unknown-copyright Reels in scoring.** Instead of Reels=80 by default, use Reels=50 (same as images) until a Reel is confirmed boostable. Only apply the Reel bonus AFTER successful boost creation.
3. **Fast-fail detection.** When the ad is created, poll `ad_review_feedback` aggressively (every 5 minutes for the first hour). Most copyright rejections come quickly.
4. **Pre-create, don't pre-boost.** Create the ad in PAUSED state, wait for review, then activate if approved. This avoids spending budget on a post that will be rejected.

### Check 3: Content Policy Compliance
**Verdict: PARTIAL — Post-submission only**

No pre-check API exists. The `ad_review_feedback` field on the Ad object returns rejection reasons AFTER submission. Rejection reasons include: copyrighted content, too much text in images, housing/credit/employment policy violations, misleading claims.

**Recommended flow:** Create ad in PAUSED state → wait for review → check `ad_review_feedback` → activate if approved.

---

## Bonus: Data We Didn't Think Of

The API gives us additional signals that could improve boost decisions:

| Signal | Endpoint | How It Helps |
|--------|----------|-------------|
| `ig_reels_skip_rate` (NEW Dec 2025) | Media insights | High skip rate = bad content, don't boost. Low skip rate = engaging, boost aggressively. |
| `ig_reels_avg_watch_time` | Media insights | Longer watch time = more engaging Reel. Weight this in scoring. |
| `online_followers` (hourly) | User insights | Optimal boost timing — start boost when followers are most active. |
| `follows` (per media) | Media insights | Post that drove follows = high-value content. Boost more. |
| `profile_activity` (per media) | Media insights | Post drove profile actions (bio link clicks, calls, directions) = commercial intent. |
| `profile_visits` (NEW Dec 2025) | Marketing API insights | Direct attribution of profile visits to boosted ads. |
| `reposts` (NEW Dec 2025) | Media insights | Posts being reposted = viral potential. Boost immediately. |
| `total_interactions` | Media insights | Quick composite metric — useful as velocity proxy without summing individual fields. |
| `crossposted_views` (NEW Dec 2025) | Media insights | Reels shared to Facebook get extra organic reach. Good boost candidates. |

### Recommended Formula Enhancement
```
ENHANCED SCORING FORMULA:

post_score = (
  engagement_velocity_score  * 0.30 +  // Reduced from 35% — shares unreliable
  recency_score              * 0.20 +  // Unchanged
  content_type_score         * 0.10 +  // Reduced from 15% — copyright penalty on Reels
  historical_boost_score     * 0.15 +  // Unchanged
  audience_match_score       * 0.10 +  // Reduced from 15% — limited data in Phase 1
  NEW: quality_signals_score * 0.15    // NEW — skip_rate, watch_time, follows, profile_activity
)

quality_signals_score = (
  (1 - skip_rate) * 30 +              // Low skip = good (Reels only, 0 for non-Reels)
  min(avg_watch_time / 15000, 1) * 30 + // Watch time in ms, cap at 15s (Reels only)
  (follows > 0 ? 20 : 0) +            // Bonus if post drove follows
  (profile_activity > 0 ? 20 : 0)     // Bonus if post drove profile actions
)
```

---

## Rate Limit Analysis at Scale

### Per-Account Budget (200 calls/hour)

| Operation | Calls/Hour | Notes |
|-----------|-----------|-------|
| New post detection | 1 | Poll `/{ig-user-id}/media` every 2 hours = 0.5/hr |
| Velocity polling (2 active posts) | 14 | 7 calls/hr per post during 2-hour window |
| Active boost monitoring (3 boosts) | 6 | Check insights every 6 hours per boost |
| Weekly baseline refresh (amortised) | 1 | 50 calls/week = ~1/hr |
| Daily account insights | 1 | 1 call per day for demographics |
| Ad creation/management | 3 | Campaign + AdSet + Ad per boost (sporadic) |
| **Total peak usage** | **~26** | **13% of 200/hr budget** |

**Verdict: Rate limits are NOT a bottleneck.** Even at peak, we use ~13% of the per-account budget. The 200/hr limit (reduced from 5,000 in 2024-2025) is tight but workable for SuperPulse's 2-hour decision cycle.

### Marketing API Rate Limits (separate from Instagram API)

- Points-based system: 1 point/read, 3 points/write
- Standard tier: ~9,000 points/hour per ad account
- Each tenant has independent limits
- Creating a boost (Campaign + AdSet + Ad) = 9 points — negligible

---

## Permission Requirements

SuperPulse needs these Meta permissions, ALL requiring App Review:

| Permission | Purpose | Access Level | App Review? |
|-----------|---------|-------------|-------------|
| `instagram_manage_insights` | All organic insights, engagement metrics, demographics | Advanced | YES |
| `pages_read_engagement` | Basic media fields (likes, comments, type, caption) | Standard | YES |
| `pages_manage_ads` | Create/manage boost campaigns | Standard | YES |
| `ads_management` | Full Marketing API access for campaign creation | Advanced | YES |
| `ads_read` | Read historical ad performance | Standard | YES |
| `business_management` | Business-level access for multi-account setups | Advanced | YES (previously rejected — needs resubmission) |

**Timeline risk:** Meta App Review takes 2-8 weeks. `business_management` was previously rejected (client-onboarding project) due to broken privacy policy URL. Fix and resubmit immediately.

**`instagram_basic` is DEPRECATED** (Jan 2025). All references in existing code must be updated to use `instagram_manage_insights` and `pages_read_engagement`.

---

## Token Management

| Concern | Details |
|---------|---------|
| Token type | Long-lived user access token |
| Expiry | 60 days |
| Refresh | `GET /refresh_access_token` — must be 24+ hours old and not yet expired |
| At scale (500 tenants) | Automated cron job to refresh tokens at day ~50 |
| Failure mode | Expired token = account goes dark. Need monitoring + re-auth flow. |
| Account types | Business and Creator accounts only. Personal accounts = NO API access. Must enforce at onboarding. |

---

## Account Type Constraints

| Account Type | API Access | SuperPulse Compatible? |
|-------------|-----------|----------------------|
| Business | Full Graph API + Marketing API | YES |
| Creator | Full Graph API, limited Marketing API | PARTIAL — may need Business conversion |
| Personal | No API access | NO — must convert before onboarding |

SuperPulse onboarding MUST check account type and guide users to convert Personal → Business if needed. Most restaurants already have Business accounts for Instagram Insights access.

---

## Overall Verdict

### Can we build the scoring formula as described?

**YES, with modifications.** The core data is available. The formula works. But the business plan's implied simplicity ("just call the API and score") is misleading. Here's the real picture:

| Component | Complexity | Status |
|-----------|-----------|--------|
| Fetch post data (likes, comments, type, caption) | LOW | API gives this directly |
| Calculate recency | LOW | Simple timestamp math |
| Detect content type (including Reels) | LOW | Two fields, straightforward |
| Calculate engagement velocity | MEDIUM-HIGH | Requires polling system, snapshot storage, baseline caching |
| Check boost eligibility | LOW | Single API field |
| Detect copyright music | HIGH | Cannot pre-check app-uploaded posts. Try-and-fail only. |
| Historical boost performance | MEDIUM | Data available but needs batch processing + cold start handling |
| Audience match | HIGH | Raw data available, "match" is a custom AI/ML problem |
| Token management at scale | MEDIUM | Standard but must be robust |
| Meta App Review | HIGH (risk) | 2-8 week timeline, previously rejected |

### What to build first (MVP priority)

1. **Recency + Content Type scoring** — trivial, ship immediately
2. **Basic engagement scoring** (likes + comments + saves, NO velocity) — skip polling for MVP, just use current totals normalized by post age
3. **Boost eligibility check** — single field, include from day 1
4. **Try-and-fail copyright handling** — create in PAUSED state, wait for review, activate if clean
5. **Historical performance** — Phase 2, after accumulating data from first customers
6. **Engagement velocity (with polling)** — Phase 2, after proving the simpler formula works
7. **Audience match** — Phase 3, after Claude API integration

### The Wizard of Oz implication

The boardroom decision to launch "Wizard of Oz" (humans in the loop initially) is even MORE justified by these findings. The API complexity means:
- Akmal's manual judgment on "what to boost" can run BEFORE the AI is ready
- The polling infrastructure can be built while humans are making decisions
- Copyright failures are caught by human review before the AI needs to handle them
- Historical performance data accumulates during the Wizard of Oz period, solving the cold start problem

**Build the self-serve front door. Let humans make boost decisions behind the scenes. Automate one factor at a time, starting with the easiest (recency, content type) and ending with the hardest (velocity, audience match).**

---

## Boost Mechanics — Late Findings

### Organic engagement IS preserved when boosting
When using `source_instagram_media_id` to boost an existing post, likes/comments/shares from both organic AND paid accumulate on the SAME post. Social proof is preserved. SuperPulse should ALWAYS use this approach (not "dark posts" which create separate ad objects with zero social proof).

### Duplicate boost collision detection is REQUIRED
Meta blocks boosting a post that's already being promoted in another active campaign. If a user manually boosts through the Instagram app, SuperPulse's API boost attempt will FAIL. The system must:
1. Check `boost_ads_list` field on the IG Media object before attempting a boost
2. OR query Marketing API for active ads with matching `source_instagram_media_id`
3. If already promoted: skip, or queue for boost after existing promotion ends

This is a pre-boost check that MUST be in the architecture alongside `boost_eligibility_info`.

### App Review is on the critical path
`ads_management` requires Meta App Review + Business Verification. Timeline: 1-4 weeks typical. Development mode allows testing with own accounts while waiting. **Start App Review submission immediately — this is the existential gate identified in the business plan.**

---

## Appendix: Key API Endpoints Reference

```
# Basic post data
GET /{ig-media-id}?fields=like_count,comments_count,timestamp,media_type,media_product_type,caption,media_url,boost_eligibility_info,boost_ads_list

# Post insights
GET /{ig-media-id}/insights?metric=views,reach,saved,shares,likes,comments,total_interactions,follows,profile_activity

# Reel-specific insights
GET /{ig-media-id}/insights?metric=ig_reels_avg_watch_time,ig_reels_skip_rate,views,reach

# Account insights
GET /{ig-user-id}/insights?metric=follower_demographics&period=lifetime
GET /{ig-user-id}/insights?metric=online_followers&period=lifetime
GET /{ig-user-id}/insights?metric=reach,views&period=day&since={ts}&until={ts}

# Fetch user's recent media
GET /{ig-user-id}/media?fields=id,timestamp,media_type,media_product_type,caption,like_count,comments_count&limit=50

# Marketing API — create boost
POST /act_{ad-account-id}/campaigns  (objective, name, status)
POST /act_{ad-account-id}/adsets     (targeting, budget, schedule, campaign_id)
POST /act_{ad-account-id}/adcreatives (source_instagram_media_id, instagram_user_id, object_id)
POST /act_{ad-account-id}/ads        (adset_id, creative_id, status=PAUSED)

# Marketing API — monitor boost
GET /act_{ad-account-id}/insights?fields=spend,impressions,clicks,reach,frequency,cpm,cpc,ctr,actions&level=ad&time_increment=1
GET /{ad-id}?fields=ad_review_feedback,effective_status

# Token refresh
GET /{app-id}/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={secret}&fb_exchange_token={token}
```

---

*Assessment produced by 5-agent research team. All findings based on Meta developer documentation and API references as of March 2026. Real API testing recommended before finalising architecture decisions.*
