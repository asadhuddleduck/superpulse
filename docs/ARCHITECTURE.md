================================================================================
  SUPERPULSE - TECHNICAL ARCHITECTURE DOCUMENT
  Agent 11 of 49 | SuperPulse Business Plan Swarm
  Date: 2026-03-24
================================================================================


TABLE OF CONTENTS
-----------------
1. System Overview & Architecture Diagram
2. The AI Decision Engine
3. Database Schema
4. System Flows
5. Meta API Write Operations
6. MVP vs Full Product
7. 8-Week Build Plan
8. Infrastructure & Costs
9. Scalability Analysis
10. Risk Register
11. Live Ad QA Checklist


================================================================================
1. SYSTEM OVERVIEW & ARCHITECTURE DIAGRAM
================================================================================

SuperPulse is an AI-powered Instagram post boosting platform for local
businesses. The system ingests Instagram post data, evaluates engagement
signals, and autonomously creates/manages Meta ad campaigns to boost
high-performing posts with location-based radius targeting.

ARCHITECTURE DIAGRAM:

    +-------------------+       +-------------------+       +-------------------+
    |   CUSTOMER WEB    |       |   VERCEL CRONS    |       |   META GRAPH API  |
    |   (Next.js App)   |       | (Decision Engine) |       |   (v25.0)         |
    +--------+----------+       +--------+----------+       +--------+----------+
             |                           |                           ^    |
             | Auth (Clerk)              | Every 2 hours             |    |
             | Billing (Stripe)          |                           |    |
             v                           v                           |    v
    +--------+----------+       +--------+----------+       +--------+----------+
    |   API ROUTES      |       |   DECISION ENGINE |       |   WRITE OPS       |
    |   /api/connect    |       |   evaluate()      |------>|   createCampaign  |
    |   /api/dashboard  |       |   score()         |       |   adjustBudget    |
    |   /api/settings   |       |   decide()        |       |   pauseAd         |
    |   /api/webhooks   |       |   monitor()       |       |   expandRadius    |
    +--------+----------+       +--------+----------+       +-------------------+
             |                           |
             v                           v
    +-------------------------------------------+
    |             TURSO DATABASE                 |
    |  tenants | locations | ig_posts | boosts  |
    |  campaigns | decisions | performance      |
    |  tokens | billing                         |
    +-------------------------------------------+
             |
             v
    +-------------------+       +-------------------+
    |   STRIPE          |       |   RESEND          |
    |   Subscriptions   |       |   Notifications   |
    |   Usage tracking  |       |   Alerts          |
    +-------------------+       +-------------------+


SYSTEM COMPONENTS:

    +-----------+     +-----------+     +-----------+     +-----------+
    | INGESTION |---->| SCORING   |---->| EXECUTION |---->| MONITOR   |
    | Fetch IG  |     | AI Engine |     | Meta API  |     | Track KPI |
    | posts     |     | rank &    |     | create/   |     | adjust/   |
    | & metrics |     | decide    |     | modify    |     | report    |
    +-----------+     +-----------+     +-----------+     +-----------+
         ^                                                      |
         |                                                      |
         +------------------< FEEDBACK LOOP >-------------------+


REUSED FROM EXISTING CODEBASE:

  - Turso lazy proxy pattern (client-dashboards/src/lib/db.ts)
  - Meta API fetch wrapper with backoff (client-dashboards/src/lib/meta-api.ts)
  - INSERT OR REPLACE sync pattern (client-dashboards/src/lib/sync.ts)
  - Facebook OAuth flow structure (client-onboarding/)
  - Ad account health check (client-onboarding/src/lib/meta-health.ts)
  - Cron-based pipeline pattern (client-dashboards vercel.json, duck-emails)
  - Notion integration for internal ops


================================================================================
2. THE AI DECISION ENGINE
================================================================================

2.1 DATA INPUTS
---------------
The decision engine consumes the following data for each tenant:

  INPUT                      SOURCE                    REFRESH RATE
  -----------------------------------------------------------------------
  Post engagement metrics    Instagram Graph API        Every 2 hours
    - likes, comments,       (GET /{ig-user}/media)
      shares, saves, reach
  Post age (time since       Calculated from            Real-time
    published)               timestamp field
  Content type               Instagram Graph API        On fetch
    (image, video, carousel)
  Historical boost perf.     Turso performance_data     Continuous
    (CPM, CPC, CPR by post)
  Location performance       Turso (per-location        Daily aggregation
    history)                 stats)
  Budget remaining           Turso billing table        Real-time check
    (monthly allocation)
  Audience saturation        Meta Insights API          Every 6 hours
    (frequency > threshold)  (frequency field)
  Current active boosts      Turso active_campaigns     Real-time
  Day of week / time         System clock               Real-time
  Post caption/content       Instagram Graph API        On fetch
    (for Claude evaluation)


2.2 DECISION CADENCE
--------------------
The engine runs on a TIERED schedule:

  CRON JOB                FREQUENCY       PURPOSE
  -----------------------------------------------------------------------
  post-scanner            Every 2 hours   Fetch new posts, calculate
                                          engagement velocity
  boost-evaluator         Every 2 hours   Score posts, decide boost/no-boost
                                          (runs after post-scanner)
  performance-monitor     Every 6 hours   Check active boosts, adjust
                                          budget/radius/pause
  daily-reconciler        Once daily      Budget reconciliation, spend
                          (02:00 UTC)     tracking, billing sync
  weekly-optimizer        Once weekly     Retrain scoring weights,
                          (Mon 03:00)     performance reports

  WHY 2 HOURS, NOT REAL-TIME:
  - Instagram engagement stabilises ~2-4 hours after posting
  - Meta API rate limits: 200 calls/hour/ad account (Business tier)
  - Vercel cron Pro plan: up to every 1 minute, but 2hr is efficient
  - Real-time adds complexity with marginal benefit for local businesses


2.3 DECISIONS THE ENGINE MAKES
------------------------------

  DECISION            TRIGGER                          ACTION
  -----------------------------------------------------------------------
  BOOST               Post scores above threshold      Create campaign +
                      AND budget available             ad set + ad
                      AND < max active boosts

  DONT_BOOST          Post scores below threshold      Log decision,
                      OR budget exhausted              skip

  INCREASE_BUDGET     CTR > 2x location avg            Increase daily
                      AND frequency < 2.0              budget by 25%
                      AND budget headroom exists        (capped at max)

  DECREASE_BUDGET     CTR < 0.5x location avg          Decrease daily
                      OR frequency > 3.0               budget by 25%
                      OR CPM > 2x location avg          (floor at min)

  PAUSE               Frequency > 4.0                  Pause ad set
                      OR total spend > post budget
                      OR 7 days elapsed (max duration)

  EXPAND_RADIUS       CTR > 1.5x avg AND               Increase radius
                      frequency < 1.5 AND              by 2km
                      radius < max_radius              (max 25km)

  REDUCE_RADIUS       CPM increasing >20% day-over-    Decrease radius
                      day AND frequency > 2.5          by 2km (min 3km)

  REBOOST             Previously paused post gets       Create new
                      new engagement spike             campaign
                      (>50% of original velocity)


2.4 SCORING ALGORITHM
---------------------
Phase 1 (MVP): Rule-based heuristic scoring
Phase 2: ML model trained on historical boost performance

MVP SCORING FORMULA:

  post_score = (
    engagement_velocity_score * 0.30 +   // How fast it's gaining engagement (reduced from 35%)
    recency_score              * 0.20 +   // Decays after 24 hours
    content_type_score         * 0.10 +   // Video > Carousel > Image (reduced — copyright penalty on Reels)
    historical_boost_score     * 0.15 +   // Past boost performance of similar posts
    audience_match_score       * 0.10 +   // Location relevance (reduced — limited data Phase 1)
    quality_signals_score      * 0.15     // NEW: skip_rate, avg_watch_time, follows, profile_activity
  )

  ENGAGEMENT VELOCITY:
    ev = (likes + comments*3 + saves*4) / hours_since_posted
    ev_score = min(ev / location_avg_ev, 1.0) * 100

    Note: Shares dropped — DM shares never exposed via API (see API-FEASIBILITY.md).
    Saves signal intent and reach potential. Comments signal conversation. Likes are passive.

  CONTENT TYPE:
    VIDEO    = 80  (Reels dominate reach)
    CAROUSEL = 70  (Higher engagement per impression)
    IMAGE    = 50  (Baseline)

  RECENCY:
    recency_score = max(0, 100 - (hours_since_posted * 4))
    // Linear decay: 100 at 0h, 0 at 25h

  HISTORICAL BOOST:
    // Average ROAS of past boosts for this content type at this location
    // 0-100 scale, 50 = no history (neutral)

  AUDIENCE MATCH:
    // Does the post content match the location's best-performing content?
    // Phase 1: always 50 (neutral). Phase 2: Claude API content analysis.

  BOOST THRESHOLD: 55 (adjustable per tenant)

  TIEBREAKER: If multiple posts exceed threshold, boost the highest-scoring
  post first. If budget allows, boost up to max_active_boosts posts.


2.5 MULTI-LOCATION HANDLING
----------------------------

  MODEL: Per-location budget allocation with shared pool

  +------------------+
  | TENANT           |
  | monthly_budget:  |
  | $1,000           |
  +--------+---------+
           |
    +------+------+------+
    |             |      |
  +-+----+   +---+--+ +-+-----+
  | LOC1 |   | LOC2 | | LOC3  |
  | 40%  |   | 35%  | | 25%   |
  | $400 |   | $350 | | $250  |
  +------+   +------+ +-------+

  ALLOCATION RULES:
  1. Default: equal split across locations
  2. After 2 weeks: weighted by performance (CPR-based)
  3. Admin override: tenant can set custom % per location
  4. Minimum floor: no location gets < 10% of total
  5. Rebalancing: weekly on the daily-reconciler job

  PER-LOCATION SETTINGS:
  - boost_radius_km (default: 8km, range: 3-25km)
  - max_active_boosts (default: 3)
  - boost_threshold (default: 55)
  - excluded_days (e.g., restaurant closed Mondays)
  - target_demographics (inherited from tenant, overridable)


2.6 CLAUDE API INTEGRATION (PHASE 2)
-------------------------------------
For content evaluation and caption analysis:

  USE CASE                      MODEL           COST/CALL
  -----------------------------------------------------------------------
  Post caption quality check    Haiku 4.5       ~$0.001
  Ad copy generation from post  Sonnet 4.6      ~$0.01
  Weekly performance summary    Sonnet 4.6      ~$0.02
  Content category detection    Haiku 4.5       ~$0.001

  Budget at 500 customers: ~$15-30/month (negligible)

  DEFERRED TO PHASE 2 because rule-based scoring is sufficient for MVP.
  The biggest signal is engagement velocity, not content quality.


================================================================================
3. DATABASE SCHEMA
================================================================================

All tables use Turso (LibSQL/SQLite). Follows existing conventions:
- TEXT for IDs (no auto-increment integers for primary keys)
- INSERT OR REPLACE for idempotent upserts
- ISO datetime strings for timestamps
- REAL for currency amounts (NOT cents — matching client-dashboards convention)

---

-- TENANTS (the business that subscribes to SuperPulse)
CREATE TABLE IF NOT EXISTS tenants (
  id                TEXT PRIMARY KEY,          -- UUID
  name              TEXT NOT NULL,             -- Business name
  email             TEXT NOT NULL,             -- Primary contact email
  clerk_user_id     TEXT UNIQUE,               -- Clerk auth user ID
  stripe_customer_id TEXT,                     -- Stripe customer ID
  stripe_subscription_id TEXT,                 -- Stripe subscription ID
  plan              TEXT DEFAULT 'starter',    -- starter | growth | pro
  monthly_budget    REAL DEFAULT 0,            -- Total monthly ad spend budget (GBP)
  currency          TEXT DEFAULT 'GBP',        -- GBP | USD | AED
  status            TEXT DEFAULT 'onboarding', -- onboarding | active | paused | churned
  meta_page_id      TEXT,                      -- Facebook Page ID (connected)
  ig_business_id    TEXT,                      -- Instagram Business Account ID
  meta_ad_account_id TEXT,                     -- act_XXXXXXXX
  onboarded_at      TEXT,                      -- ISO datetime
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- OAUTH TOKENS (encrypted Meta tokens per tenant)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id                TEXT PRIMARY KEY,          -- UUID
  tenant_id         TEXT NOT NULL,             -- FK -> tenants.id
  provider          TEXT DEFAULT 'meta',       -- meta (future: google, tiktok)
  access_token      TEXT NOT NULL,             -- Encrypted long-lived token
  token_expires_at  TEXT,                      -- ISO datetime (60-day expiry)
  scopes            TEXT,                      -- Comma-separated granted scopes
  refresh_token     TEXT,                      -- For token refresh
  last_refreshed_at TEXT,                      -- ISO datetime
  created_at        TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_tokens_tenant ON oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON oauth_tokens(token_expires_at);

-- LOCATIONS (per-tenant locations/branches)
CREATE TABLE IF NOT EXISTS locations (
  id                TEXT PRIMARY KEY,          -- UUID
  tenant_id         TEXT NOT NULL,             -- FK -> tenants.id
  name              TEXT NOT NULL,             -- e.g. "Manchester - Oxford Road"
  address           TEXT,                      -- Full address
  latitude          REAL,                      -- For radius targeting
  longitude         REAL,                      -- For radius targeting
  boost_radius_km   REAL DEFAULT 8.0,          -- Current targeting radius
  max_radius_km     REAL DEFAULT 25.0,         -- Upper bound
  min_radius_km     REAL DEFAULT 3.0,          -- Lower bound
  budget_pct        REAL DEFAULT 0,            -- % of tenant monthly budget (0 = auto)
  max_active_boosts INTEGER DEFAULT 3,         -- Max simultaneous boosted posts
  boost_threshold   REAL DEFAULT 55.0,         -- Minimum score to boost
  is_active         INTEGER DEFAULT 1,
  created_at        TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id);

-- INSTAGRAM POSTS (fetched from IG Graph API)
CREATE TABLE IF NOT EXISTS ig_posts (
  id                TEXT PRIMARY KEY,          -- Instagram media ID
  tenant_id         TEXT NOT NULL,
  ig_business_id    TEXT NOT NULL,             -- Which IG account
  media_type        TEXT NOT NULL,             -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url         TEXT,                      -- Media URL (expires)
  thumbnail_url     TEXT,                      -- For video thumbnails
  permalink         TEXT,                      -- Permanent IG link
  caption           TEXT,                      -- Post caption
  timestamp         TEXT NOT NULL,             -- ISO datetime when posted
  like_count        INTEGER DEFAULT 0,
  comments_count    INTEGER DEFAULT 0,
  shares_count      INTEGER DEFAULT 0,         -- Requires IG Business API
  saves_count       INTEGER DEFAULT 0,         -- Requires IG Business API
  reach             INTEGER DEFAULT 0,
  impressions       INTEGER DEFAULT 0,
  engagement_velocity REAL DEFAULT 0,          -- Calculated: weighted eng / hours
  boost_eligible    INTEGER DEFAULT 1,         -- 0 if ineligible (story, etc.)
  boost_score       REAL DEFAULT 0,            -- Last calculated score (0-100)
  last_scored_at    TEXT,                      -- When score was last calculated
  last_fetched_at   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_posts_tenant ON ig_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON ig_posts(timestamp);
CREATE INDEX IF NOT EXISTS idx_posts_score ON ig_posts(boost_score);

-- BOOST DECISIONS (audit log of every decision the engine makes)
CREATE TABLE IF NOT EXISTS boost_decisions (
  id                TEXT PRIMARY KEY,          -- UUID
  tenant_id         TEXT NOT NULL,
  location_id       TEXT,                      -- Which location (NULL = all)
  ig_post_id        TEXT,                      -- Which post
  decision          TEXT NOT NULL,             -- BOOST | DONT_BOOST | INCREASE |
                                               -- DECREASE | PAUSE | EXPAND_RADIUS |
                                               -- REDUCE_RADIUS | REBOOST
  reason            TEXT,                      -- Human-readable explanation
  score             REAL,                      -- Post score at time of decision
  score_breakdown   TEXT,                      -- JSON: {velocity: x, type: x, ...}
  previous_state    TEXT,                      -- JSON: previous campaign state
  new_state         TEXT,                      -- JSON: new campaign state
  executed          INTEGER DEFAULT 0,         -- 1 if Meta API call succeeded
  execution_error   TEXT,                      -- Error message if failed
  created_at        TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (ig_post_id) REFERENCES ig_posts(id)
);
CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON boost_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_post ON boost_decisions(ig_post_id);
CREATE INDEX IF NOT EXISTS idx_decisions_date ON boost_decisions(created_at);

-- ACTIVE CAMPAIGNS (Meta campaigns created by SuperPulse)
CREATE TABLE IF NOT EXISTS active_campaigns (
  id                TEXT PRIMARY KEY,          -- Meta campaign ID
  tenant_id         TEXT NOT NULL,
  location_id       TEXT,
  ig_post_id        TEXT NOT NULL,
  adset_id          TEXT,                      -- Meta ad set ID
  ad_id             TEXT,                      -- Meta ad ID
  meta_ad_account_id TEXT NOT NULL,            -- The ad account used
  status            TEXT DEFAULT 'ACTIVE',     -- ACTIVE | PAUSED | COMPLETED
  daily_budget      REAL NOT NULL,             -- Current daily budget (currency units)
  total_budget      REAL,                      -- Lifetime budget cap for this boost
  total_spent       REAL DEFAULT 0,            -- Running total of spend
  radius_km         REAL,                      -- Current targeting radius
  targeting_spec    TEXT,                      -- JSON: full Meta targeting spec
  started_at        TEXT DEFAULT (datetime('now')),
  paused_at         TEXT,
  completed_at      TEXT,
  expires_at        TEXT,                      -- Auto-pause after this datetime
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (ig_post_id) REFERENCES ig_posts(id)
);
CREATE INDEX IF NOT EXISTS idx_active_tenant ON active_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_active_status ON active_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_active_post ON active_campaigns(ig_post_id);

-- PERFORMANCE DATA (daily stats for each active campaign)
CREATE TABLE IF NOT EXISTS performance_data (
  campaign_id       TEXT NOT NULL,
  date              TEXT NOT NULL,             -- YYYY-MM-DD
  spend             REAL DEFAULT 0,
  impressions       INTEGER DEFAULT 0,
  reach             INTEGER DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  cpm               REAL DEFAULT 0,            -- Cost per 1000 impressions
  cpc               REAL DEFAULT 0,            -- Cost per click
  ctr               REAL DEFAULT 0,            -- Click-through rate %
  frequency         REAL DEFAULT 0,
  link_clicks       INTEGER DEFAULT 0,
  post_engagement   INTEGER DEFAULT 0,         -- Total engagement on boosted post
  PRIMARY KEY (campaign_id, date),
  FOREIGN KEY (campaign_id) REFERENCES active_campaigns(id)
);
CREATE INDEX IF NOT EXISTS idx_perf_date ON performance_data(date);

-- MONTHLY SPEND TRACKING (per-tenant, per-month budget tracking)
CREATE TABLE IF NOT EXISTS monthly_spend (
  tenant_id         TEXT NOT NULL,
  month             TEXT NOT NULL,             -- YYYY-MM
  budget            REAL NOT NULL,             -- Allocated budget for month
  spent             REAL DEFAULT 0,            -- Total spent so far
  boost_count       INTEGER DEFAULT 0,         -- Number of boosts this month
  PRIMARY KEY (tenant_id, month),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- NOTIFICATION LOG (emails/alerts sent to tenants)
CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY,          -- UUID
  tenant_id         TEXT NOT NULL,
  type              TEXT NOT NULL,             -- boost_started | budget_alert |
                                               -- performance_report | token_expiring
  channel           TEXT DEFAULT 'email',      -- email | in_app
  subject           TEXT,
  sent_at           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);


SCHEMA RELATIONSHIP DIAGRAM:

  tenants ─────────────┐
    |                   |
    ├── locations       ├── oauth_tokens
    |     |             |
    ├── ig_posts        ├── monthly_spend
    |     |             |
    |     ├── boost_decisions
    |     |     |
    |     └── active_campaigns
    |           |
    |           └── performance_data
    |
    └── notifications


================================================================================
4. SYSTEM FLOWS
================================================================================

4.1 CUSTOMER ONBOARDING
------------------------

  Step 1: Sign Up
  ┌──────────────────────────────────────────────────┐
  │ User visits superpulse.co.uk                     │
  │ → Clerk sign-up (email + password or Google SSO) │
  │ → INSERT INTO tenants (clerk_user_id, email)     │
  │ → Redirect to /connect                           │
  └──────────────────────────────────────────────────┘
                          |
  Step 2: Connect Instagram + Meta
  ┌──────────────────────────────────────────────────┐
  │ Facebook Login dialog with scopes:               │
  │   - instagram_manage_insights                    │
  │     (replaces deprecated instagram_basic)        │
  │   - pages_show_list                              │
  │   - pages_read_engagement                        │
  │   - ads_management                               │
  │   - ads_read                                     │
  │   - business_management                          │
  │                                                  │
  │ On callback:                                     │
  │   1. Exchange code for short-lived token          │
  │   2. Exchange for long-lived token (60 days)     │
  │   3. Fetch IG Business Account ID                │
  │   4. Fetch linked Facebook Page                  │
  │   5. Fetch ad accounts, let user select one      │
  │   6. Run ad account health check                 │
  │   7. Store encrypted token in oauth_tokens       │
  │   8. UPDATE tenants SET ig_business_id, etc.     │
  └──────────────────────────────────────────────────┘
                          |
  Step 3: Configure Locations
  ┌──────────────────────────────────────────────────┐
  │ User adds 1+ locations:                          │
  │   - Name, address                                │
  │   - Geocode address → lat/lng (Google Maps API   │
  │     or browser geolocation)                      │
  │   - Set initial boost radius (default 8km)       │
  │   - INSERT INTO locations                        │
  └──────────────────────────────────────────────────┘
                          |
  Step 4: Set Budget & Subscribe
  ┌──────────────────────────────────────────────────┐
  │ Stripe Checkout:                                 │
  │   - Select plan (Starter/Growth/Pro)             │
  │   - Set monthly ad spend budget                  │
  │   - Payment method for platform fee              │
  │   - INSERT INTO monthly_spend                    │
  │   - UPDATE tenants SET status = 'active'         │
  └──────────────────────────────────────────────────┘
                          |
  Step 5: Initial Scan
  ┌──────────────────────────────────────────────────┐
  │ Trigger immediate post-scanner for this tenant:  │
  │   - Fetch last 25 posts from Instagram           │
  │   - Score all posts                              │
  │   - If any score > threshold, boost immediately  │
  │   - Show "Your AI is now watching" confirmation  │
  └──────────────────────────────────────────────────┘


4.2 DECISION LOOP (CORE ENGINE)
-------------------------------

  Every 2 hours (Vercel Cron → /api/cron/evaluate):

  ┌─────────────────────────────────────┐
  │ 1. FETCH NEW POSTS                  │
  │    For each active tenant:          │
  │    GET /{ig_user}/media             │
  │    ?fields=id,media_type,caption,   │
  │     timestamp,like_count,           │
  │     comments_count,permalink        │
  │    INSERT OR REPLACE INTO ig_posts  │
  └──────────────┬──────────────────────┘
                 │
  ┌──────────────v──────────────────────┐
  │ 2. FETCH ENGAGEMENT METRICS         │
  │    For posts < 48 hours old:        │
  │    GET /{media_id}/insights         │
  │    ?metric=reach,impressions,       │
  │     shares,saved,engagement         │
  │    UPDATE ig_posts SET metrics      │
  └──────────────┬──────────────────────┘
                 │
  ┌──────────────v──────────────────────┐
  │ 3. CALCULATE ENGAGEMENT VELOCITY    │
  │    For each updated post:           │
  │    ev = (likes + comments*3 +       │
  │          saves*4)                   │
  │         / hours_since_posted        │
  │    UPDATE ig_posts SET              │
  │      engagement_velocity = ev       │
  └──────────────┬──────────────────────┘
                 │
  ┌──────────────v──────────────────────┐
  │ 4. SCORE POSTS                      │
  │    For each post not already        │
  │    boosted and < 24 hours old:      │
  │    Calculate post_score (0-100)     │
  │    using scoring formula            │
  │    UPDATE ig_posts SET boost_score  │
  └──────────────┬──────────────────────┘
                 │
  ┌──────────────v──────────────────────┐
  │ 5. MAKE BOOST DECISIONS             │
  │    For each location:               │
  │    - Check budget remaining         │
  │    - Check active boost count       │
  │    - Find highest-scoring eligible  │
  │      post above threshold           │
  │    - If found: DECISION = BOOST     │
  │    - Else: DECISION = DONT_BOOST    │
  │    INSERT INTO boost_decisions      │
  └──────────────┬──────────────────────┘
                 │
  ┌──────────────v──────────────────────┐
  │ 6. EXECUTE BOOST DECISIONS          │
  │    For each BOOST decision:         │
  │    a) Create Meta Campaign          │
  │       (objective: POST_ENGAGEMENT)  │
  │    b) Create Ad Set                 │
  │       (radius targeting, budget)    │
  │    c) Create Ad                     │
  │       (existing post as creative)   │
  │    d) INSERT INTO active_campaigns  │
  │    e) UPDATE boost_decisions        │
  │       SET executed = 1              │
  └─────────────────────────────────────┘


  Every 6 hours (Vercel Cron → /api/cron/monitor):

  ┌─────────────────────────────────────┐
  │ 7. MONITOR ACTIVE CAMPAIGNS         │
  │    For each active campaign:        │
  │    a) Fetch insights from Meta      │
  │    b) INSERT OR REPLACE INTO        │
  │       performance_data              │
  │    c) Check adjustment triggers:    │
  │       - Frequency > 4.0 → PAUSE    │
  │       - CTR > 2x avg → INCREASE    │
  │       - CTR < 0.5x avg → DECREASE  │
  │       - Reached spend cap → PAUSE   │
  │       - 7 days elapsed → PAUSE     │
  │    d) Execute adjustments via       │
  │       Meta API                      │
  │    e) Log to boost_decisions        │
  └─────────────────────────────────────┘


4.3 TOKEN REFRESH FLOW
-----------------------

  Meta long-lived tokens expire after 60 days.

  Daily check (part of daily-reconciler cron):

  ┌──────────────────────────────────────────────────┐
  │ SELECT * FROM oauth_tokens                       │
  │ WHERE token_expires_at < datetime('now', '+7d')  │
  │                                                  │
  │ For each expiring token:                         │
  │   1. Call Meta token refresh endpoint             │
  │   2. GET /oauth/access_token                     │
  │      ?grant_type=fb_exchange_token               │
  │      &client_id={app_id}                         │
  │      &client_secret={app_secret}                 │
  │      &fb_exchange_token={current_token}          │
  │   3. If success: UPDATE oauth_tokens             │
  │   4. If fail: Send notification to tenant         │
  │      "Please reconnect your Instagram"           │
  │   5. After 3 failed refreshes: pause all boosts  │
  └──────────────────────────────────────────────────┘


4.4 BILLING FLOW
-----------------

  STRIPE BILLING MODEL:
  - Platform fee: Monthly subscription (Starter £49, Growth £99, Pro £199, + Managed Boost £100)
  - Ad spend: NOT billed through Stripe — spent directly on tenant's
    Meta ad account. SuperPulse only controls HOW it's spent.

  ┌──────────────────────────────────────────────────┐
  │ stripe.checkout.sessions.create({                │
  │   mode: 'subscription',                          │
  │   line_items: [{                                 │
  │     price: plan_price_id,                        │
  │     quantity: 1                                  │
  │   }],                                            │
  │   metadata: { tenant_id }                        │
  │ })                                               │
  └──────────────────────────────────────────────────┘

  Webhook: checkout.session.completed
  → UPDATE tenants SET stripe_customer_id, stripe_subscription_id, status

  Webhook: customer.subscription.deleted
  → UPDATE tenants SET status = 'churned'
  → Pause all active campaigns via Meta API

  Webhook: customer.subscription.updated
  → If downgrade: adjust monthly_budget caps
  → If upgrade: unlock higher budget/location limits


================================================================================
5. META API WRITE OPERATIONS
================================================================================

All write operations extend the existing metaFetch pattern from
client-dashboards/src/lib/meta-api.ts with POST/DELETE support.

5.1 API VERSION
  - Upgrade from v24.0 to v25.0
  - Set META_API_VERSION = "v25.0" globally

5.2 REQUIRED PERMISSIONS (OAuth Scopes)
  - instagram_manage_insights (read IG profile + media + insights; replaces deprecated instagram_basic since Jan 2025)
  - pages_show_list (list connected pages)
  - pages_read_engagement (read page engagement)
  - ads_management (create/edit/delete campaigns, ad sets, ads)
  - ads_read (read campaign data)
  - business_management (manage business assets)

  NOTE: ads_management requires Advanced Access from Meta App Review.
  This was previously rejected for client-onboarding. Strategy:
  - Submit new app specifically for SuperPulse
  - Provide clear use case: "Automated post boosting for business owners"
  - Include privacy policy, terms of service, data deletion callback
  - Record screencast of working app with test ad account

5.3 WRITE OPERATION SIGNATURES

  All functions accept tenant's decrypted access_token as parameter,
  NOT the global META_ACCESS_TOKEN.

  --- CREATE CAMPAIGN ---
  async function createBoostCampaign(params: {
    accessToken: string;
    adAccountId: string;
    postId: string;          // For naming convention
    locationName: string;    // For naming convention
    dailyBudget: number;     // In currency units (NOT cents)
    lifetimeBudget?: number;
  }): Promise<{ campaignId: string }>

  Meta API call:
  POST /{ad_account_id}/campaigns
  Body:
    name: "SP | {location} | {post_id} | {date}"
    objective: "OUTCOME_ENGAGEMENT"
    status: "PAUSED"    // Create PAUSED — activate after Meta ad review (try-and-fail copyright pattern)
    special_ad_categories: []     // Unless tenant is housing/credit/employment
    daily_budget: amount * 100    // Meta expects cents

  --- CREATE AD SET ---
  async function createBoostAdSet(params: {
    accessToken: string;
    adAccountId: string;
    campaignId: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
    dailyBudget: number;
  }): Promise<{ adSetId: string }>

  Meta API call:
  POST /{ad_account_id}/adsets
  Body:
    name: "SP AdSet | {location} | {radius}km"
    campaign_id: campaignId
    billing_event: "IMPRESSIONS"
    optimization_goal: "POST_ENGAGEMENT"
    daily_budget: amount * 100
    targeting: {
      geo_locations: {
        custom_locations: [{
          latitude: lat,
          longitude: lng,
          radius: radiusKm,
          distance_unit: "kilometer"
        }]
      },
      age_min: 18,
      age_max: 65
    }
    status: "PAUSED"    // Create PAUSED — activate after Meta ad review

  --- CREATE AD (boost existing post) ---
  async function createBoostAd(params: {
    accessToken: string;
    adAccountId: string;
    adSetId: string;
    igPostId: string;
    pageId: string;
  }): Promise<{ adId: string }>

  Meta API call:
  POST /{ad_account_id}/ads
  Body:
    name: "SP Ad | {post_id}"
    adset_id: adSetId
    creative: {
      object_story_id: "{page_id}_{ig_post_id}"
      // OR for IG: use existing_post creative spec
    }
    status: "PAUSED"    // Create PAUSED — poll ad_review_feedback, activate if approved

  --- ADJUST BUDGET ---
  async function adjustBudget(params: {
    accessToken: string;
    adSetId: string;
    newDailyBudget: number;
  }): Promise<void>

  Meta API call:
  POST /{adset_id}
  Body:
    daily_budget: newDailyBudget * 100

  --- PAUSE / UNPAUSE ---
  async function setCampaignStatus(params: {
    accessToken: string;
    campaignId: string;
    status: 'ACTIVE' | 'PAUSED';
  }): Promise<void>

  Meta API call:
  POST /{campaign_id}
  Body:
    status: "ACTIVE" | "PAUSED"

  --- EXPAND / REDUCE RADIUS ---
  async function adjustRadius(params: {
    accessToken: string;
    adSetId: string;
    latitude: number;
    longitude: number;
    newRadiusKm: number;
  }): Promise<void>

  Meta API call:
  POST /{adset_id}
  Body:
    targeting: {
      geo_locations: {
        custom_locations: [{
          latitude, longitude,
          radius: newRadiusKm,
          distance_unit: "kilometer"
        }]
      }
    }


================================================================================
6. MVP vs FULL PRODUCT
================================================================================

6.1 MVP (8 WEEKS) — "It works, it's useful, people will pay"
--------------------------------------------------------------

  INCLUDED:
  [x] Customer sign-up (Clerk auth)
  [x] Instagram + Meta OAuth connection
  [x] Single-location support only
  [x] Post fetching + engagement tracking
  [x] Rule-based scoring algorithm
  [x] Automated boost creation (campaign + ad set + ad)
  [x] Budget cap enforcement (monthly + per-boost)
  [x] Auto-pause on frequency threshold or time limit
  [x] Basic dashboard: active boosts, spend, performance
  [x] Stripe subscription (single plan: $79/month)
  [x] Email notifications: boost started, budget alert, token expiring
  [x] Token refresh automation
  [x] Decision audit log (visible in dashboard)

  MVP CONSTRAINTS:
  - 1 location per tenant (multi-location = Phase 2)
  - No radius expansion/reduction (fixed radius)
  - No budget rebalancing
  - No ML scoring (rule-based only)
  - No Claude API content analysis
  - No custom targeting demographics
  - Single plan, no tiers
  - No white-label / agency features
  - Manual onboarding support available

6.2 PHASE 2 (Weeks 9-16) — "It's smart"
-----------------------------------------

  [ ] Multi-location support with budget allocation
  [ ] Dynamic radius adjustment (expand/reduce)
  [ ] Reboost detection (re-engage paused posts)
  [ ] Claude API content evaluation
  [ ] Performance-based scoring weight adjustment
  [ ] 3-tier pricing (Starter/Growth/Pro)
  [ ] Weekly email performance reports
  [ ] Custom targeting demographics per location

6.3 PHASE 3 (Weeks 17-24) — "It's a platform"
-----------------------------------------------

  [ ] Agency/white-label mode (manage multiple tenant accounts)
  [ ] ML-trained scoring model (learns from historical performance)
  [ ] A/B testing: boost same post with different radii
  [ ] Advanced analytics dashboard
  [ ] API for integrations
  [ ] Mobile app (React Native)
  [ ] Competitor monitoring
  [ ] TikTok/Google Ads expansion


================================================================================
7. 8-WEEK MVP BUILD PLAN
================================================================================

WEEK 1: Foundation
------------------
  Day 1-2:
    - Create Next.js project (App Router, TypeScript, Tailwind)
    - Set up git repo, Vercel deployment, Turso database
    - Create CLAUDE.md project config
    - Set up Clerk auth (sign-up, sign-in, middleware)
    - Design token encryption utility (AES-256-GCM for token storage)

  Day 3-4:
    - Create Turso schema (all MVP tables)
    - Build db.ts (lazy proxy pattern)
    - Build meta-api-write.ts (extending existing metaFetch)
    - Implement createBoostCampaign, createBoostAdSet, createBoostAd

  Day 5:
    - Unit test Meta API write operations against sandbox ad account
    - Test campaign creation → ad set → ad chain

  DELIVERABLE: Working Meta API write layer, auth, database

WEEK 2: OAuth & Onboarding
---------------------------
  Day 1-2:
    - Facebook Login integration (JS SDK + server callback)
    - Token exchange flow (short-lived → long-lived)
    - Encrypted token storage in Turso
    - Fetch IG Business Account + connected Page

  Day 3-4:
    - Ad account selection UI
    - Ad account health check (reuse from client-onboarding)
    - Location setup form (address + geocoding)
    - INSERT INTO tenants, locations, oauth_tokens

  Day 5:
    - End-to-end onboarding flow testing
    - Error handling (rejected permissions, disabled accounts)

  DELIVERABLE: Working onboarding: sign up → connect IG → add location

WEEK 3: Post Ingestion & Scoring
---------------------------------
  Day 1-2:
    - Instagram media fetching (GET /{ig_user}/media)
    - Instagram insights fetching (GET /{media_id}/insights)
    - INSERT OR REPLACE into ig_posts

  Day 3-4:
    - Engagement velocity calculator
    - Post scoring algorithm (all 5 factors)
    - Boost eligibility checker (age, type, already boosted)
    - Score storage + recalculation logic

  Day 5:
    - Test with real Instagram account
    - Validate scoring produces sensible rankings

  DELIVERABLE: Posts fetched, scored, ranked for each tenant

WEEK 4: Decision Engine Core
-----------------------------
  Day 1-2:
    - Boost decision logic (evaluate → decide → log)
    - Budget cap enforcement
    - Max active boosts enforcement
    - boost_decisions audit trail

  Day 3-4:
    - Campaign execution pipeline:
      Score → Decision → Create Campaign → Create Ad Set → Create Ad
    - Error handling + rollback (if ad creation fails, clean up campaign)
    - INSERT INTO active_campaigns

  Day 5:
    - End-to-end test: post appears → scores → decision → campaign created
    - Verify campaign appears in Meta Ads Manager

  DELIVERABLE: Working autonomous boost pipeline

WEEK 5: Monitoring & Adjustments
---------------------------------
  Day 1-2:
    - Performance data fetching (Meta Insights for active campaigns)
    - INSERT OR REPLACE into performance_data
    - Frequency threshold detection → auto-pause

  Day 3-4:
    - Budget adjustment logic (increase/decrease)
    - Time-based auto-pause (7-day maximum)
    - Spend cap enforcement
    - Token refresh automation (daily check)

  Day 5:
    - Vercel cron setup:
      post-scanner: "0 */2 * * *" (every 2h)
      performance-monitor: "0 */6 * * *" (every 6h)
      daily-reconciler: "0 2 * * *" (2am UTC)

  DELIVERABLE: Full autonomous loop running on crons

WEEK 6: Customer Dashboard
---------------------------
  Day 1-2:
    - Dashboard layout (dark theme, viridian green, sandstorm yellow)
    - Active boosts view (cards with performance metrics)
    - Boost history timeline

  Day 3-4:
    - Spend tracking chart (daily/monthly)
    - Decision log viewer (why each decision was made)
    - Settings page (budget, radius, threshold)

  Day 5:
    - Account connection status indicator
    - "Pause all" / "Resume all" controls
    - Mobile responsive polish

  DELIVERABLE: Functional customer dashboard

WEEK 7: Billing & Notifications
---------------------------------
  Day 1-2:
    - Stripe integration (Checkout, Customer Portal, Webhooks)
    - Subscription lifecycle (create, update, cancel)
    - Plan limits enforcement

  Day 3-4:
    - Resend email templates:
      - Welcome + getting started
      - Boost started notification
      - Weekly spend summary
      - Budget nearly exhausted warning
      - Token expiring (re-auth needed)
    - In-app notification bell

  Day 5:
    - Stripe webhook testing (subscription events)
    - Email delivery testing

  DELIVERABLE: Complete billing + notification system

WEEK 8: Testing, Polish & Launch Prep
--------------------------------------
  Day 1-2:
    - End-to-end testing with real accounts
    - Meta App Review submission (ads_management scope)
    - Error boundary + graceful degradation
    - Rate limit testing

  Day 3-4:
    - Landing page (or integrate with existing start.huddleduck.co.uk)
    - Privacy policy, Terms of Service, Data Deletion Callback
    - Sentry error monitoring setup
    - Performance optimization (ISR for dashboard)

  Day 5:
    - Beta invite to 3-5 existing clients
    - Monitor first autonomous boost decisions
    - Fix any issues from beta

  DELIVERABLE: MVP live with beta users


================================================================================
8. INFRASTRUCTURE & COSTS
================================================================================

8.1 STACK COSTS (Monthly)
--------------------------

  SERVICE         FREE TIER       100 TENANTS    500 TENANTS    1000 TENANTS
  -------------------------------------------------------------------------
  Vercel Pro      $20/mo          $20            $20            $20
  Turso           9 DBs free      $29 (Scaler)   $29 (Scaler)   $299 (Enterprise)
  Clerk           10K MAU free    $0             $25            $50
  Stripe          2.9% + 30c      ~$230*         ~$1,150*       ~$2,300*
  Resend          100/day free    $20 (Pro)      $20 (Pro)      $80 (Scale)
  Sentry          5K events free  $0             $26            $80
  Domain/DNS      ~$15/yr         $1.25          $1.25          $1.25
  Claude API**    Pay per use     $15            $30            $60
  -------------------------------------------------------------------------
  TOTAL (est.)                    ~$315/mo       ~$1,301/mo     ~$2,890/mo

  * Stripe cost assumes avg $79/mo subscription
    100 tenants: $7,900 revenue → $230 Stripe fees
    500 tenants: $39,500 revenue → $1,150 Stripe fees
    1000 tenants: $79,000 revenue → $2,300 Stripe fees

  ** Claude API is Phase 2 only; $0 for MVP

  REVENUE vs COST:
    100 tenants:  $7,900 revenue  - $315 costs  = $7,585 margin (96%)
    500 tenants:  $39,500 revenue - $1,301 costs = $38,199 margin (97%)
    1000 tenants: $79,000 revenue - $2,890 costs = $76,110 margin (96%)


8.2 VERCEL CRON CONFIGURATION (vercel.json)
--------------------------------------------

  {
    "crons": [
      {
        "path": "/api/cron/scan-posts",
        "schedule": "0 */2 * * *"
      },
      {
        "path": "/api/cron/evaluate-boosts",
        "schedule": "15 */2 * * *"
      },
      {
        "path": "/api/cron/monitor-performance",
        "schedule": "0 */6 * * *"
      },
      {
        "path": "/api/cron/daily-reconcile",
        "schedule": "0 2 * * *"
      },
      {
        "path": "/api/cron/token-refresh",
        "schedule": "0 3 * * *"
      }
    ]
  }


8.3 ENVIRONMENT VARIABLES
--------------------------

  # Core
  TURSO_DATABASE_URL        # libsql://superpulse-xxx.turso.io
  TURSO_AUTH_TOKEN           # Turso auth token
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  CLERK_WEBHOOK_SECRET       # For Clerk webhooks

  # Meta / Facebook
  NEXT_PUBLIC_FB_APP_ID      # Facebook App ID (client-side)
  FB_APP_SECRET              # Facebook App Secret (server-side)
  META_APP_ID                # Same as FB_APP_ID (server-side)
  TOKEN_ENCRYPTION_KEY       # AES-256 key for encrypting stored tokens

  # Stripe
  STRIPE_SECRET_KEY
  STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_STARTER_PRICE_ID    # Phase 2
  STRIPE_GROWTH_PRICE_ID
  STRIPE_PRO_PRICE_ID        # Phase 2

  # Notifications
  RESEND_API_KEY
  FROM_EMAIL                  # noreply@superpulse.co.uk

  # Monitoring
  SENTRY_DSN
  CRON_SECRET                 # Auth for cron endpoints


================================================================================
9. SCALABILITY ANALYSIS
================================================================================

9.1 META API RATE LIMITS
--------------------------

  Meta Business Use Case Rate Limits (v25.0):
  - Standard tier: 200 calls/hour/ad account
  - Business tier: 1000 calls/hour/ad account (after spending $10K+)

  PER-TENANT API CALLS (every 2-hour cycle):
    - Fetch recent posts:          1 call
    - Fetch insights per post:     ~5 calls (last 5 posts)
    - Score + decision:            0 calls (local computation)
    - Create campaign:             1 call  (if boosting)
    - Create ad set:               1 call  (if boosting)
    - Create ad:                   1 call  (if boosting)
    ─────────────────────────────────────────
    Total per tenant per cycle:    ~9 calls (max)
    Per hour: ~5 calls

  AT SCALE:
    100 tenants:  ~500 calls/hr → Well within limits (200/acct * 100 accts)
    500 tenants:  ~2,500 calls/hr → Fine (rate limit is PER ad account)
    1000 tenants: ~5,000 calls/hr → Fine (each tenant's calls hit THEIR acct)

  KEY INSIGHT: Rate limits are PER AD ACCOUNT, not per app. So scaling
  tenants does NOT compound rate limit pressure. Each tenant's 5 calls/hr
  is well within the 200/hr/account limit.

  WHEN IT BREAKS:
  - Never, for per-account limits (5/200 = 2.5% utilization)
  - App-level rate limit: 200 * (number of ad accounts) calls/hr
    This is effectively unlimited for our use case.
  - The real bottleneck is Vercel function execution time, not Meta API.

9.2 VERCEL FUNCTION EXECUTION
-------------------------------

  Vercel Pro: 800s max duration, 1GB memory, concurrent execution.

  CRON EXECUTION TIME (estimated):
    100 tenants:  ~2-3 minutes per cron run (serial processing)
    500 tenants:  ~10-15 minutes (need parallel batching)
    1000 tenants: ~20-30 minutes (need queue system)

  SCALING STRATEGY:
    < 200 tenants:  Single cron, serial processing → fine
    200-500:        Cron triggers batches of 50 tenants in parallel
                    (Promise.allSettled with concurrency limiter)
    500-1000:       Split into 10 cron endpoints (/cron/evaluate/0-9)
                    Each handles 100 tenants. Fan-out from single trigger.
    > 1000:         Move to Vercel Queue (or external: BullMQ/Inngest)
                    Cron enqueues jobs, workers process independently.

9.3 TURSO DATABASE
-------------------

  Turso Scaler plan limits:
  - 100 billion rows read/month
  - 25 million rows written/month
  - 24GB total storage

  PER-TENANT DATA VOLUME (monthly):
    - ig_posts: ~30 rows (1 post/day)
    - boost_decisions: ~360 rows (12/day * 30)
    - active_campaigns: ~10-15 rows
    - performance_data: ~210 rows (7 campaigns * 30 days)
    - monthly_spend: 1 row
    ─────────────────────────────────────
    Total writes/tenant/month: ~600 rows
    Total reads/tenant/month: ~3,000 rows (dashboard + engine queries)

  AT SCALE:
    100 tenants:  60K writes, 300K reads → 0.2% of Scaler limits
    500 tenants:  300K writes, 1.5M reads → 1.2% of Scaler limits
    1000 tenants: 600K writes, 3M reads → 2.4% of Scaler limits

  WHEN IT BREAKS:
  - Storage at 1000 tenants after 2 years: ~2GB → fine (24GB limit)
  - Turso won't be the bottleneck until >10K tenants
  - If needed: shard by tenant groups (multiple Turso databases)

9.4 DECISION ENGINE SOPHISTICATION
------------------------------------

  CRON-BASED (MVP → 500 tenants):
  - Simple, reliable, easy to debug
  - 2-hour decision cycle is fine for post boosting
  - Vercel cron Pro can run every minute if needed

  WHEN TO UPGRADE:
  - > 500 tenants: Cron execution time > 10 min
    → Move to Vercel Queue or Inngest
    → Event-driven: "new post detected" triggers evaluation pipeline

  - > 1000 tenants: Need real-time post detection
    → Instagram webhook subscriptions (POST /webhooks)
    → React to new posts within minutes, not hours

  - > 2000 tenants: ML model training
    → Export performance data to external ML pipeline
    → Train personalized scoring model per industry vertical
    → Deploy as API endpoint, decision engine calls it

  PROGRESSION:
    Stage 1 (MVP):     Cron → Rule-based scoring → Direct Meta API calls
    Stage 2 (500+):    Queue → Rule-based + Claude API → Batched Meta API
    Stage 3 (2000+):   Webhooks → ML model → Queue → Batched Meta API
    Stage 4 (10000+):  Dedicated infra (not Vercel) → Kubernetes → ML


================================================================================
10. RISK REGISTER
================================================================================

  RISK                           LIKELIHOOD   IMPACT    MITIGATION
  -------------------------------------------------------------------------
  Meta App Review rejection      HIGH         BLOCKING  Submit early (Week 2),
  (ads_management scope)                                provide clear docs,
                                                        screencast, privacy
                                                        policy. Plan 4-6 weeks
                                                        for review. Use test
                                                        ad accounts until
                                                        approved.

  Customer token expires and     MEDIUM       HIGH      Auto-refresh 7 days
  they don't re-auth                                    before expiry. 3 email
                                                        reminders. Auto-pause
                                                        boosts after 3 fails.

  Meta API changes/deprecation   LOW          HIGH      Pin to v25.0. Monitor
                                                        Meta changelog. Abstract
                                                        all Meta calls behind
                                                        interface layer.

  Customer overspend due to      LOW          CRITICAL  Hard budget caps in DB.
  engine bug                                            Daily reconciler checks
                                                        actual spend vs budget.
                                                        Kill switch: pause all
                                                        on budget exceed.

  Post boosting produces poor    MEDIUM       MEDIUM    Conservative defaults.
  results for customer                                  7-day max boost duration.
                                                        Frequency cap at 4.0.
                                                        Dashboard transparency.

  Vercel cron timeout at scale   MEDIUM       MEDIUM    Batch processing from
                                                        day 1. Fan-out pattern
                                                        ready. Queue migration
                                                        planned at 500 tenants.

  Instagram API rate limits      LOW          LOW       Only 5-9 calls per
  (separate from Ads API)                               tenant per cycle.
                                                        Exponential backoff
                                                        already implemented.


================================================================================
11. LIVE AD QA CHECKLIST
================================================================================

  Run this checklist EVERY TIME we go live on a new ad account — Asad's own
  IG first (currently pending, 28 Apr 2026), then each of the 6 legacy clients
  during Phase 1 onboarding.

  This checklist exists because the Meta API silently accepts unknown fields,
  so a payload that returns 200 from the API can still produce an ad with the
  WRONG placements, multi-advertiser bundling ON, or Advantage+ enhancements
  applied. The only way to be sure is to inspect the resulting campaign in
  Ads Manager.

  Origin: AD-CONFIG-TWEAKS spec (10 Apr 2026), implemented in commit 9f004a5
  (27 Apr 2026). Replaces the per-deploy verification steps in that doc once
  it's deleted.

11.1 PRE-FLIGHT (LOCAL)
-----------------------

  [ ] cd superpulse && npx tsc --noEmit       # no type errors
  [ ] cd superpulse && npm run build          # clean build
  [ ] ENCRYPTION_KEY env present in .env.local AND on Vercel prod
  [ ] FB_APP_ID + FB_APP_SECRET present in both
  [ ] Tenant row exists for the test IG, status = active, FB token decrypts
      cleanly via getCurrentToken()

11.2 LIVE BOOST (TEST RUN)
--------------------------

  Use a NON-Reel post (image post or carousel) on the test IG so we don't get
  blocked by the copyright try-and-fail loop on the first run. Reels can be
  tested separately once the basic config is verified.

  [ ] Sign in as the test tenant via /login
  [ ] Confirm the post grid renders with the test IG's posts
  [ ] Trigger boost on a chosen post via the live dashboard (or POST
      /api/boost/create with the post ID)
  [ ] API returns 200 with { campaignId, adSetId, creativeId, adId }
  [ ] Campaign appears in Ads Manager within 60s (status = PAUSED)

11.3 ADS MANAGER CHECKS (THE FIVE)
----------------------------------

  Open the new campaign in Ads Manager and verify EACH of the following.
  All five must pass before flipping the originating Notion task to Done.

  [ ] CHECK 1 — Placements
      Edit the ad set → Placements section.
      EXPECTED: Manual Placements selected. Only "Instagram" platform
      checked. Within Instagram, ONLY "Reels" and "Stories" enabled.
      All other surfaces (Feed, Explore, Search, Profile Feed) UNCHECKED.
      No Facebook surfaces. No Audience Network. No Messenger.
      Device: Mobile only.
      If a check fails: re-verify src/lib/facebook.ts:343-359 targeting
      payload. Most likely cause: a new Meta default placement was added
      after our v25.0 verification.

  [ ] CHECK 2 — Multi-advertiser ads toggle
      Edit the ad → bottom of Ad Setup.
      EXPECTED: "Multi-advertiser ads" toggle is OFF.
      If a check fails: re-verify src/lib/facebook.ts:455-460. The opt-out
      field is multi_advertiser_ads.has_opted_out = true at the Ad level
      (NOT AdSet, NOT Campaign).

  [ ] CHECK 3 — Advantage+ creative enhancements
      Edit the ad → "Optimization & delivery" / "Advantage+ creative"
      section. EXPECTED: every enhancement listed shows as OFF or
      "Opted out". The current opt-out keys (src/lib/facebook.ts:417-427):
        - standard_enhancements
        - image_brightness_and_contrast
        - image_uncrop
        - image_touchups
        - text_optimizations
        - image_templates
        - video_auto_crop
        - audio
        - advantage_plus_creative
      Meta silently ignores unknown keys, so it's safe to include the full
      list. If Meta has added new enhancement keys since v25.0, this
      checklist should be updated to add them.

  [ ] CHECK 4 — Ad identity (actor_id verification)
      View the live ad preview in Ads Manager. EXPECTED: the ad shows the
      linked Facebook Page name as the advertiser identity, and the ad
      surfaces the IG post (caption, media) correctly.
      KEY DECISION: this codebase uses actor_id (NOT object_id) at
      src/lib/facebook.ts:405. Meta's IG Reels adcreatives example uses
      object_id, and the fbts-code-auditor recommended switching, but
      actor_id was empirically verified working on 9 Apr 2026 against
      act_1059094086326037.
      If this check FAILS (identity is missing, blank, or shows the wrong
      page): the documented fallback is to swap actor_id → object_id in
      createAdCreative. If swapping fixes it, update this checklist + the
      code comment to record that object_id is now canonical.

  [ ] CHECK 5 — Call-to-action link
      Click into the ad creative preview. The CTA button should read
      "View Instagram profile" and link to https://www.instagram.com/
      {test-ig-username}/. If the CTA is missing OR links to a generic
      website URL, re-verify src/lib/facebook.ts:408-413.

11.4 OUTCOME
------------

  All 5 pass:
    1. Tick the corresponding boxes in docs/AD-CONFIG-TWEAKS.md
    2. Flip Notion task 33e84fd7bc4e81569027ed8ba0539b17 to Done
    3. In a follow-up commit, delete docs/AD-CONFIG-TWEAKS.md (this
       checklist persists in ARCHITECTURE.md and supersedes it)
    4. Activate the test campaign and let it run with a small budget
       to confirm Meta ad review approves it

  Any check fails:
    1. Capture a screenshot of the failing surface in Ads Manager
    2. DO NOT activate the test campaign — leave it PAUSED
    3. Fix the payload in src/lib/facebook.ts, redeploy, re-run from
       section 11.2 with a fresh post
    4. Repeat until all 5 pass


================================================================================
  END OF TECHNICAL ARCHITECTURE DOCUMENT
================================================================================

  Summary:
  - The system is a cron-driven decision engine that scores Instagram posts
    and autonomously creates/manages Meta ad campaigns for local businesses.
  - MVP scope is deliberately narrow: 1 location, fixed radius, rule-based
    scoring, single pricing tier. This can be built in 8 weeks.
  - The architecture scales to 1000+ tenants on current infrastructure
    ($2,890/mo cost vs $79,000/mo revenue = 96% margin).
  - The biggest risk is Meta App Review for ads_management permission.
    This should be submitted in Week 2 with a 4-6 week buffer.
  - All patterns reuse proven code from the existing Huddle Duck codebase:
    Turso lazy proxy, Meta API fetch with backoff, INSERT OR REPLACE,
    Vercel cron pipelines, and the OAuth flow from client-onboarding.
