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
-- live in docs/INCIDENT-LOG.md (kept out of this file because the schema
-- splitter naively splits on ; and breaks on semicolons in SQL examples).
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
