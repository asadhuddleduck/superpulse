CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  ig_user_id TEXT,
  ad_account_id TEXT,
  name TEXT,
  meta_access_token TEXT,
  meta_pixel_id TEXT,
  page_id TEXT,
  ig_username TEXT,
  status TEXT DEFAULT 'pending_oauth',
  token_expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent column adds for tenants tables that pre-date the new columns.
-- runSchema() swallows "duplicate column name" errors so these are safe to re-run.
ALTER TABLE tenants ADD COLUMN meta_access_token TEXT;
ALTER TABLE tenants ADD COLUMN meta_pixel_id TEXT;
ALTER TABLE tenants ADD COLUMN page_id TEXT;
ALTER TABLE tenants ADD COLUMN ig_username TEXT;
ALTER TABLE tenants ADD COLUMN status TEXT DEFAULT 'pending_oauth';
ALTER TABLE tenants ADD COLUMN token_expires_at TEXT;
ALTER TABLE tenants ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tenants_ig_user_id ON tenants(ig_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_miles REAL DEFAULT 5.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);

CREATE TABLE IF NOT EXISTS api_call_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_call_log_created_at ON api_call_log(created_at);
CREATE INDEX IF NOT EXISTS idx_api_call_log_tenant_id ON api_call_log(tenant_id);

CREATE TABLE IF NOT EXISTS ig_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  timestamp TEXT,
  like_count INTEGER,
  comments_count INTEGER,
  media_type TEXT,
  engagement_rate REAL,
  boost_eligible INTEGER DEFAULT 1,
  ineligible_reason TEXT,
  copyright_music INTEGER DEFAULT 0
);

ALTER TABLE ig_posts ADD COLUMN boost_eligible INTEGER DEFAULT 1;
ALTER TABLE ig_posts ADD COLUMN ineligible_reason TEXT;
ALTER TABLE ig_posts ADD COLUMN copyright_music INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS active_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  post_id TEXT,
  location_id INTEGER,
  ad_account_id TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  status TEXT DEFAULT 'PAUSED',
  daily_budget REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE active_campaigns ADD COLUMN location_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_active_campaigns_tenant_id ON active_campaigns(tenant_id);

CREATE TABLE IF NOT EXISTS performance_data (
  campaign_id TEXT,
  date TEXT,
  impressions INTEGER,
  reach INTEGER,
  clicks INTEGER,
  spend REAL,
  profile_visits INTEGER,
  PRIMARY KEY(campaign_id, date)
);

CREATE TABLE IF NOT EXISTS boost_settings (
  tenant_id TEXT PRIMARY KEY,
  daily_budget_cap REAL DEFAULT 5.0,
  target_radius_miles REAL DEFAULT 5.0,
  auto_boost_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT DEFAULT 'nec-2026',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE waitlist ADD COLUMN locations_count INTEGER;
ALTER TABLE waitlist ADD COLUMN instagram_handle TEXT;
ALTER TABLE waitlist ADD COLUMN business_type TEXT;
ALTER TABLE waitlist ADD COLUMN first_name TEXT;
ALTER TABLE waitlist ADD COLUMN utm_source TEXT;
ALTER TABLE waitlist ADD COLUMN utm_medium TEXT;
ALTER TABLE waitlist ADD COLUMN utm_campaign TEXT;
ALTER TABLE waitlist ADD COLUMN utm_content TEXT;
ALTER TABLE waitlist ADD COLUMN utm_term TEXT;
ALTER TABLE waitlist ADD COLUMN landed_at TEXT;

CREATE TABLE IF NOT EXISTS audit_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  instagram_handle TEXT,
  tier TEXT NOT NULL,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  parent_session_id TEXT,
  refunded INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'webhook',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_purchases ADD COLUMN source TEXT DEFAULT 'webhook';

CREATE INDEX IF NOT EXISTS idx_audit_purchases_email ON audit_purchases(email);
CREATE INDEX IF NOT EXISTS idx_audit_purchases_customer ON audit_purchases(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_purchases_parent ON audit_purchases(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_purchases_pi ON audit_purchases(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS qualifier_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  business_type TEXT,
  locations_count INTEGER,
  has_instagram INTEGER NOT NULL DEFAULT 0,
  posts_actively INTEGER NOT NULL DEFAULT 0,
  has_business_manager INTEGER NOT NULL DEFAULT 0,
  has_run_ads INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  audit_offer_choice TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE qualifier_responses ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_qualifier_email ON qualifier_responses(email);
CREATE INDEX IF NOT EXISTS idx_qualifier_qualified ON qualifier_responses(qualified, created_at DESC);

ALTER TABLE waitlist ADD COLUMN last_landed_at TEXT;
ALTER TABLE waitlist ADD COLUMN last_utm_source TEXT;
ALTER TABLE waitlist ADD COLUMN last_utm_medium TEXT;
ALTER TABLE waitlist ADD COLUMN last_utm_campaign TEXT;
ALTER TABLE waitlist ADD COLUMN last_utm_content TEXT;
ALTER TABLE waitlist ADD COLUMN last_utm_term TEXT;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket_key TEXT NOT NULL,
  window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hit_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_buckets(bucket_key, window_start DESC);

-- Audit events: human-readable activity feed for the dashboard StatusPanel.
-- Distinct from api_call_log, which is machine-facing (App Review quota tracking).
-- Write sites: end of every cron processTenant(), every campaign create/activate, Stripe webhook events.
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant
  ON audit_events(tenant_id, created_at DESC);

-- Phase 4 (Stripe billing) — additive columns on tenants.
ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'pending';
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN email TEXT;
ALTER TABLE tenants ADD COLUMN legacy INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON tenants(stripe_customer_id);

-- Meta rate-limit telemetry (added 2026-05-02 after the deprecation incident).
-- Captures `X-App-Usage` and `X-Business-Use-Case-Usage` from every Meta
-- response. Before this table existed we had ZERO visibility into rate limits.
-- Non-fatal: rows are skipped when both headers are absent. Query examples
-- live in docs/INCIDENT-LOG.md (kept out of this file because runSchema
-- splits on a single character and would mis-parse semicolons in comments).
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_account_id TEXT,
  endpoint TEXT NOT NULL,
  app_usage_json TEXT,
  buc_usage_json TEXT,
  captured_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_captured_at ON rate_limit_log(captured_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_account ON rate_limit_log(ad_account_id, captured_at DESC);

-- v8 engine schema (added 2026-05-04). One campaign per tenant, N adsets
-- per campaign (one per location), every eligible Reel as an ad in every
-- adset. AI tweaks budgets via 3x spread guardrail; auto-pauses underperformers.
-- Spec: docs/V8-SPEC.md sections 17 and Schema. CBO disabled at launch
-- (cbo_enabled DEFAULT 0); see handover doc for re-enable plan.

CREATE TABLE IF NOT EXISTS tenant_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL UNIQUE,
  meta_campaign_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  daily_budget_pennies INTEGER NOT NULL,
  cbo_enabled INTEGER NOT NULL DEFAULT 0,
  spend_cap_pennies INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS location_adsets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_campaign_id INTEGER NOT NULL REFERENCES tenant_campaigns(id),
  location_id INTEGER NOT NULL REFERENCES locations(id),
  meta_adset_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  daily_budget_pennies INTEGER,
  min_daily_budget_pennies INTEGER,
  max_daily_budget_pennies INTEGER,
  current_spend_today_pennies INTEGER DEFAULT 0,
  last_guardrail_write_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_campaign_id, location_id)
);

CREATE TABLE IF NOT EXISTS reel_ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_adset_id INTEGER NOT NULL REFERENCES location_adsets(id),
  post_id TEXT NOT NULL REFERENCES ig_posts(id),
  meta_ad_id TEXT NOT NULL UNIQUE,
  meta_creative_id TEXT,
  status TEXT NOT NULL DEFAULT 'PAUSED',
  ai_score REAL,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT,
  retired_reason TEXT,
  UNIQUE(location_adset_id, post_id)
);

CREATE TABLE IF NOT EXISTS ai_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  input_hash TEXT,
  input_json TEXT,
  output_json TEXT,
  llm_model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_pennies INTEGER,
  narrative TEXT,
  valid INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Intent queue produced by decide cron, drained by execute cron. Also
-- enqueued by monitor cron when stop conditions trigger.
CREATE TABLE IF NOT EXISTS v8_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  ai_decision_id INTEGER REFERENCES ai_decisions(id),
  intent_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reel_ads_adset ON reel_ads(location_adset_id, status);
CREATE INDEX IF NOT EXISTS idx_location_adsets_campaign ON location_adsets(tenant_campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_tenant_time ON ai_decisions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v8_intents_pending ON v8_intents(tenant_id, status, created_at);

-- Waitlist email sequence (welcome + 10-week nurture). See src/lib/email/.
CREATE TABLE IF NOT EXISTS email_sequence_state (
  email TEXT PRIMARY KEY,
  anchor_at TEXT NOT NULL,                 -- offsets count from here (join date / backfill date)
  position INTEGER NOT NULL DEFAULT -1,    -- last step sent; -1 = none
  status TEXT NOT NULL DEFAULT 'active',   -- active | completed | unsubscribed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  step INTEGER NOT NULL,
  variant TEXT,
  resend_id TEXT,
  status TEXT NOT NULL,                     -- sent | error
  error TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email, step);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  email TEXT PRIMARY KEY,
  reason TEXT,
  unsubscribed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===========================================================================
-- v8 provisioning + budget intake (added 2026-06-02). All additive: every new
-- column defaults NULL/pending for existing rows, so legacy + active tenants
-- behave identically. runSchema() swallows "duplicate column"/"already exists".
-- ===========================================================================

-- Budget-intake axis. provisioning_status is SEPARATE from tenants.status
-- (which is load-bearing for the live dashboard gate) — it is NULL for every
-- existing tenant, so no existing tenant is ever redirected or re-provisioned.
-- Values: NULL | pending_locations | pending_budget | provisioning | provisioned | provision_failed
ALTER TABLE tenants ADD COLUMN provisioning_status TEXT;
ALTER TABLE tenants ADD COLUMN monthly_ad_budget_pennies INTEGER;
ALTER TABLE tenants ADD COLUMN budget_approved_at TEXT;
CREATE INDEX IF NOT EXISTS idx_tenants_provisioning ON tenants(provisioning_status);

-- Provisioning-progress markers on the v8 creation tables (observability + a
-- cheap "what's still PAUSED" read). pending -> created -> active; reel_ads may
-- also be in_review | rejected. NULL/pending for any pre-existing soak rows.
ALTER TABLE location_adsets ADD COLUMN provision_state TEXT DEFAULT 'pending';
ALTER TABLE reel_ads ADD COLUMN provision_state TEXT DEFAULT 'pending';

-- Indexes for the provision-cron diff + the creation-lane intent drain at
-- 62-adset scale (intent_type-scoped, distinct from idx_v8_intents_pending).
CREATE INDEX IF NOT EXISTS idx_reel_ads_postid ON reel_ads(post_id);
CREATE INDEX IF NOT EXISTS idx_v8_intents_type_pending ON v8_intents(tenant_id, intent_type, status);

-- ===========================================================================
-- Demo branch (added 2026-06-12). locations_count >= 3 at quiz time unlocks a
-- 1 on 1 demo offer before the £27 audit offer. demo_qualified freezes the
-- rule at submission time. demo_offer_choice: 'yes' | 'no' | NULL (never
-- shown). demo_requested_at is set once, on the first yes, and gates the
-- Slack alert so re-submits never double-fire. Written ONLY by /api/demo —
-- the quiz upsert must never touch demo_offer_choice / demo_requested_at.
-- ===========================================================================
ALTER TABLE qualifier_responses ADD COLUMN demo_qualified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE qualifier_responses ADD COLUMN demo_offer_choice TEXT;
ALTER TABLE qualifier_responses ADD COLUMN demo_requested_at TEXT;

-- ===========================================================================
-- Cal.com self-book (added 2026-06-15). Qualified owners self-book a call on
-- /waitlist/demo via an inline Cal embed; the booking drops into the founder's
-- connected calendar. The Cal webhook (/api/webhook/cal) is the source of
-- truth: it sets demo_scheduled_at (ISO start time of the booked slot),
-- cal_booking_uid (Cal's booking uid, also the Meta dedup key), and
-- demo_booking_status ('booked' | 'rescheduled' | 'cancelled'). It also sets
-- demo_offer_choice='yes' and demo_requested_at (if null) so the existing demo
-- dashboards keep working. cal_webhook_events logs every delivery keyed on
-- (uid, trigger) for exactly-once processing.
-- ===========================================================================
ALTER TABLE qualifier_responses ADD COLUMN demo_scheduled_at TEXT;
ALTER TABLE qualifier_responses ADD COLUMN cal_booking_uid TEXT;
ALTER TABLE qualifier_responses ADD COLUMN demo_booking_status TEXT;

CREATE TABLE IF NOT EXISTS cal_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cal_booking_uid TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cal_booking_uid, trigger_event)
);

CREATE INDEX IF NOT EXISTS idx_cal_webhook_uid ON cal_webhook_events(cal_booking_uid);
CREATE INDEX IF NOT EXISTS idx_qualifier_scheduled ON qualifier_responses(demo_scheduled_at);

-- ===========================================================================
-- WhatsApp pre-call reminders (added 17 Jun 2026). The demo-reminders cron sends
-- a ~24h and ~1h WhatsApp reminder before a booked call; these mark each as sent
-- so it fires exactly once per booking. See docs/WHATSAPP-NOTIFICATIONS.md.
-- ===========================================================================
ALTER TABLE qualifier_responses ADD COLUMN reminder_24h_sent_at TEXT;
ALTER TABLE qualifier_responses ADD COLUMN reminder_1h_sent_at TEXT;

-- ===========================================================================
-- Niche source (added 17 Jun 2026). Carried from waitlist.source so per-niche
-- conversion (qualified / demo / purchase) is trackable, not just signups.
-- Many niche "head" landing pages feed the ONE shared waitlist; ?source=<niche>
-- tags which one. See landing-factory src/lib/waitlist-link.ts.
-- ===========================================================================
ALTER TABLE qualifier_responses ADD COLUMN source TEXT;

-- ===========================================================================
-- WhatsApp opt-in (added 17 Jun 2026). WhatsApp policy REQUIRES explicit prior
-- opt-in before any business-initiated template message — a phone number alone
-- is NOT consent. Captured via an unchecked checkbox on the waitlist form; the
-- Cal webhook + demo-reminders cron only send WhatsApp when this is 1. Email
-- stays the unconditional channel. See docs/WHATSAPP-NOTIFICATIONS.md.
-- ===========================================================================
ALTER TABLE waitlist ADD COLUMN whatsapp_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE waitlist ADD COLUMN whatsapp_opt_in_at TEXT;
