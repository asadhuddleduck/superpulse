# Multi-tenant Phase 1 — OAuth + Per-Tenant Plumbing

**Shipped:** 27 Apr 2026
**Notion task:** [Multi-tenant Phase 1 — OAuth + per-tenant plumbing](https://www.notion.so/34e84fd7bc4e81f3b90ef31c90730fb7)

## What changed

The data plane and auth plane are now multi-tenant: any signed-in tenant's
crons can run unattended, every cookie-bound endpoint reads from
`tenants.meta_access_token` (decrypted on read), and the OAuth callback
no longer assumes there is exactly one Page-with-IG.

### 1. Token encryption at rest (AES-256-GCM)
- `src/lib/crypto.ts` — versioned blob format: `v1:<iv>:<authTag>:<ciphertext>` (all base64).
- `ENCRYPTION_KEY` is a 32-byte key stored in `.env.local` and Vercel env (production + preview).
  Generate a fresh one with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `upsertTenant()` and `updateTenantToken()` call `ensureEncrypted()` before write.
- `rowToTenant()` calls `decryptIfNeeded()` so callers receive plaintext transparently.
- `decryptIfNeeded()` is a no-op on values lacking the `v1:` prefix — handles unmigrated rows during cutover.
- `scripts/encrypt-tenant-tokens.ts` — one-shot migration. Idempotent.

### 2. Page picker (`/onboarding/select-page`)
- The OAuth callback inspects `pages.filter(p => p.instagram_business_account)`.
  - 0 pages-with-IG → existing fallback path (tenant id from FB user id, no IG fields).
  - 1 page-with-IG → existing auto-pick path → status='active' → `/dashboard`.
  - >1 pages-with-IG → write tenant row with `status='pending_page_selection'` carrying the encrypted token, redirect to `/onboarding/select-page`.
- The picker is a server component — it reads tenant from cookie, refetches Pages with the stored token, renders radio cards.
- POST `/api/onboarding/select-page` flips status to `'active'` after wiring `page_id` / `ig_user_id` / `ig_username` / `ad_account_id` from the chosen Page.
- Dashboard layout redirects `pending_page_selection` tenants back to the picker.

### 3. Removed raw FB-token cookie (`fb_access_token`)
- `tenant_id` cookie is now the only auth cookie. All tokens come from `tenants.meta_access_token`.
- Replaced `getTokenCookie()` everywhere with `getCurrentTenant()` / `getCurrentToken()` from `lib/auth.ts`.
- Updated 8 callers: `boost/create`, `boost/settings`, `campaigns`, `instagram/posts`, `dashboard/{layout,page,posts}`, `login/page`.
- Deleted `TenantBootstrap.tsx` and `/api/tenant/sync` — they existed only to migrate users with a stale `fb_access_token` cookie. With the new flow they're redundant.
- `/api/auth/logout` defensively clears both `tenant_id` and the legacy `fb_access_token` so any browser still holding it gets scrubbed.
- **Latent bug fixed:** `/api/boost/settings` was using a hardcoded `DEFAULT_TENANT_ID = 'default'` for both reads and writes. It now uses the tenant id from the cookie like every other route.

### 4. Cron concurrency
- Both `/api/cron/scan-posts` and `/api/cron/monitor` use a 5-wide worker pool (`TENANT_CONCURRENCY = 5`).
- Plain Promise.all over a shared cursor — no extra dep.
- Per-tenant errors stay isolated; one tenant blowing up doesn't block the others.
- Picked 5 because Meta's per-app rate limit is ~200 calls/hour per user-token; 5 parallel tenants × ~10 calls/tick keeps well below.

## Database

No schema changes required — `tenants` already had `meta_access_token`, `status`,
`token_expires_at`, etc. Encryption is purely application-layer.

The single existing prod tenant (`t_17841400702538222`) was migrated in place:
plaintext token replaced with `v1:...` ciphertext. `getActiveTenants()`
roundtrips back to a valid `EAA...` token (smoke-tested 27 Apr 2026).

## Rollback

If decryption breaks for any reason, the cleanest rollback is:

1. Set `ENCRYPTION_KEY` to the same value used during migration (so `decryptIfNeeded`
   succeeds on existing rows).
2. To hard-rollback to plaintext: `UPDATE tenants SET meta_access_token = ?` per row,
   passing the plaintext result of `decrypt(stored)`. The `decryptIfNeeded`
   pathway means a partial mix of plaintext + ciphertext rows still works.

If the picker breaks: any tenant stuck with `status='pending_page_selection'`
can be force-activated via SQL once their Page is identified manually:
`UPDATE tenants SET page_id = ?, ig_user_id = ?, ad_account_id = ?, status = 'active' WHERE id = ?`.

## Remaining caveats

- **Vercel env required:** `ENCRYPTION_KEY` MUST be set on production AND preview
  before deploy or every tenant read will throw `ENCRYPTION_KEY env var is required`.
- **Single-account picker:** if a user authorises >1 Page but only 1 has an IG
  Business Account, the picker auto-redirects to `select-page?pageId=…` (single
  selectable choice). Same end state as the auto-pick path.
- **Concurrency cap is static:** 5 is fine for the current 6-tenant fleet.
  When the fleet grows past ~30 tenants, revisit — Meta rate limits are
  per-user-token so they don't actually share a budget across tenants, but
  Turso connection pooling might.
