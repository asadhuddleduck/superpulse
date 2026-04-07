CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  ig_user_id TEXT,
  ad_account_id TEXT,
  name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
  engagement_rate REAL
);

CREATE TABLE IF NOT EXISTS active_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  post_id TEXT,
  ad_account_id TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  status TEXT DEFAULT 'PAUSED',
  daily_budget REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
