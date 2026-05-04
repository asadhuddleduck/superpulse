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
