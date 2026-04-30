# Status Panel — Spec

**Authored:** 2026-04-30
**Notion subtask:** 3 (Audit log + status indicators)
**Component:** `src/components/StatusPanel.tsx`
**API:** `src/app/api/status/route.ts`

## Purpose

Make the magic visible. Today, scan-posts cron runs every 2h and auto-boost cron creates campaigns invisibly. Client thinks nothing is happening. StatusPanel surfaces:

- Last scan timestamp (with health dot)
- Posts detected, posts boosted, campaigns live, spend
- Recent activity feed (last 10 audit events in human-readable form)

## Schema additions

Append to `src/lib/schema.sql`:

```sql
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
```

`event_type` values: `scan_completed`, `boost_created`, `boost_activated`, `review_failed`, `spend_threshold`, `error`, `onboarding_complete`, `subscription_changed`.

## API payload (`GET /api/status`)

```ts
{
  scanLastRun: string | null,         // ISO timestamp of last 200-status row matching /{ig_user_id}/media in api_call_log
  postsDetected: number,               // SELECT COUNT(*) FROM ig_posts WHERE tenant_id=?
  postsBoosted: number,                // SELECT COUNT(DISTINCT ig_post_id) FROM active_campaigns WHERE tenant_id=?
  campaignsLive: number,               // SELECT COUNT(*) FROM active_campaigns WHERE tenant_id=? AND status='ACTIVE'
  campaignsPaused: number,             // status='PAUSED'
  spendToDate: number,                 // SUM(spend) FROM performance_data JOIN active_campaigns
  profileVisits: number,               // SUM(profile_visits)
  lastError: { endpoint, error, at } | null,  // most recent api_call_log row with status_code>=400, last 24h
  health: 'green' | 'yellow' | 'red',
  recentActivity: Array<{ event_type, message, created_at }>  // last 10 audit_events rows
}
```

## Health rules

- **green** — `scanLastRun` within last 3 hours, no errors in last 24h
- **yellow** — `scanLastRun` 3-12h ago, OR errors present but tenant subscription active
- **red** — `scanLastRun` >12h ago, OR subscription not active, OR critical error in last hour

## Polling

Custom `useInterval` hook in `StatusPanel.tsx`. 30-second cadence. No SWR dependency.

```tsx
useEffect(() => {
  const tick = async () => {
    const res = await fetch('/api/status');
    if (res.ok) setData(await res.json());
  };
  tick();
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
}, []);
```

## Audit events write sites

Every cron and every state change writes one row.

| Trigger | event_type | Example message |
|---|---|---|
| `scan-posts` cron tenant-end | `scan_completed` | "Scanned 47 posts" |
| `boost/create` per campaign | `boost_created` | "Created PAUSED campaign for 'Friday wing night' targeting Sparkhill" |
| `monitor` cron flips ACTIVE | `boost_activated` | "Campaign #4521 went live at 14:32" |
| `monitor` cron sees rejection | `review_failed` | "Campaign #4521 rejected: copyright music" |
| Spend exceeds 90% of cap | `spend_threshold` | "Spend at £270 of £300 monthly cap" |
| Any 4xx/5xx Meta API call | `error` | "Meta API 400 on /me/adaccounts: Invalid token" |
| OAuth callback success | `onboarding_complete` | "Connected @phatbuns Instagram" |
| Stripe webhook | `subscription_changed` | "Subscription activated (£300/mo)" |

Helper: `src/lib/queries/audit-events.ts` exports `writeAuditEvent(tenantId, type, message, metadata?)`. Lazy-async so the cron doesn't block on the write.

## Dashboard hero strip layout

Replaces existing stats cards in `src/app/dashboard/page.tsx`:

```
┌──────────────────────────────────────────────────────────────────┐
│ ● Last scan: 23 min ago                                          │
│                                                                  │
│  47          12          9             £142.50                   │
│  detected    boosted     live          spend (this month)        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Recent activity                                                  │
│ ──────────────                                                   │
│ 14:32  Campaign for 'Friday wing night' went live in Sparkhill   │
│ 14:31  Campaign for 'Friday wing night' went live in Hall Green  │
│ 14:29  Created 3 paused campaigns for 'Friday wing night'        │
│ 14:02  Scanned 47 posts                                          │
│ 12:14  Subscription activated (£300/mo)                          │
└──────────────────────────────────────────────────────────────────┘
```

## Verification

- `curl localhost:3000/api/status -H "Cookie: tenant_id=..."` returns valid payload shape.
- StatusPanel renders 5 cards with correct data on `/dashboard` for both legacy and new tenants.
- Triggering `/api/cron/scan-posts?secret=$CRON_SECRET` writes a new row to `audit_events`.
- Recent activity feed shows the new row within 30s of the cron firing.
