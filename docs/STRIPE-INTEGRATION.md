# Stripe Integration — Spec

**Authored:** 2026-04-30
**Notion subtask:** 5 (Stripe billing — single £300/mo tier)
**Files:** `src/lib/stripe.ts`, `src/app/pricing/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/api/webhook/stripe/route.ts`, `src/app/onboarding/support/page.tsx`

## Decisions locked

- **Single tier:** flat **£300/mo + VAT**. Multi-tier deferred (subtask 9).
- **Trial mechanism:** `FIRSTMONTHFREE` Stripe coupon (100% off, duration=once) instead of Stripe trial period. Card still required at checkout.
- **Existing clients:** same checkout flow. Six legacy tenants flagged `legacy=1` and bypass billing gate. They can self-checkout if they want; coupon makes first month free.
- **Gate position:** PRE-OAuth. Pay first → OAuth → locations → dashboard. Every Meta token belongs to a paid customer.
- **Onboarding support fork:** at `/onboarding/support`. Free resources / Meta support contact / £90 paid handhold.

## Schema additions

Append to `src/lib/schema.sql`:

```sql
ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'pending';
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN email TEXT;
ALTER TABLE tenants ADD COLUMN legacy INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer_id ON tenants(stripe_customer_id);
```

`subscription_status` values: `pending`, `active`, `trialing`, `past_due`, `canceled`, `legacy`.

## Stripe dashboard setup (manual, before deploy)

1. Create Product **"SuperPulse"**.
2. Create Price `STRIPE_PRICE_SUPERPULSE_MONTHLY` — £300/mo recurring + VAT auto-collected.
3. Create Coupon `FIRSTMONTHFREE` — 100% off, duration=once, applicable to monthly subscriptions.
4. Create Product **"SuperPulse Onboarding Handhold"** for the £90 service.
5. Create Price `STRIPE_PRICE_ONBOARDING_HANDHOLD` — £90 one-off.
6. Register webhook endpoint at `https://superpulse.io/api/webhook/stripe` with events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## Env vars

Add to `.env.local` and Vercel:

```
STRIPE_SECRET_KEY=sk_live_...               # sk_test_ for local
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SUPERPULSE_MONTHLY=price_...
STRIPE_COUPON_FIRSTMONTHFREE=...
STRIPE_PRICE_ONBOARDING_HANDHOLD=price_...
```

## `src/lib/stripe.ts` (lazy proxy)

Lift pattern from `landing-page/src/lib/stripe.ts`:

```ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY missing');
      _stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
    }
    return Reflect.get(_stripe, prop);
  },
});
```

## `/pricing` page

Single-tier card:

```
┌────────────────────────────────────────────┐
│              SuperPulse                    │
│                                            │
│              £300 /month                   │
│              (+ VAT for UK)                │
│                                            │
│  • AI-driven Instagram boost automation    │
│  • Multi-location support                  │
│  • Daily scoring + auto-launch             │
│  • Real-time performance dashboard         │
│                                            │
│  Promo code: [______________________]      │
│                                            │
│         [ Continue to checkout ]           │
└────────────────────────────────────────────┘
```

Submit POSTs to `/api/checkout` with `{ promo_code }` if provided.

## `/api/checkout` route

```ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const { promo_code } = await req.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_SUPERPULSE_MONTHLY!, quantity: 1 }],
    discounts: promo_code ? [{ coupon: process.env.STRIPE_COUPON_FIRSTMONTHFREE! }] : undefined,
    payment_method_collection: 'always',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboarding/connect?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
    automatic_tax: { enabled: true },
    customer_creation: 'always',
    subscription_data: {
      metadata: { source: 'superpulse-direct' },
    },
  });

  return NextResponse.json({ url: session.url });
}
```

## `/api/webhook/stripe` route

Event handlers:

| Event | Action |
|---|---|
| `checkout.session.completed` | Create or update tenant, set `subscription_status='active'`, set `stripe_customer_id`, set `stripe_subscription_id`, set `email` from `customer_details.email`. Write `audit_events` row. |
| `customer.subscription.updated` | Sync `subscription_status` (`trialing`/`active`/`past_due`/`canceled`). |
| `customer.subscription.deleted` | Set `subscription_status='canceled'`, pause all active campaigns via `updateCampaignStatus(id, 'PAUSED', token)`. Write audit event. |
| `invoice.payment_failed` | Set `subscription_status='past_due'`, send `failureAlert` email (subtask 7). After 7 days unresolved: pause campaigns. |

Webhook signature verification using `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`. Reject any request without valid signature with 400.

## Cron gate

In `src/app/api/cron/scan-posts/route.ts`, before processing each tenant:

```ts
if (!['active', 'trialing'].includes(tenant.subscription_status) && !tenant.legacy) {
  result.error = `Subscription not active (${tenant.subscription_status})`;
  return result;
}
```

Same gate in `monitor` and any future automation cron.

## Dashboard layout gate

In `src/app/dashboard/layout.tsx`:

```ts
if (!tenant.legacy) {
  if (!tenant.subscription_status || tenant.subscription_status === 'pending') {
    redirect('/pricing');
  }
  if (tenant.status === 'pending_oauth') redirect('/onboarding/connect');
  if (tenant.status === 'pending_page_selection') redirect('/onboarding/select-page');
  if (tenant.status === 'pending_locations') redirect('/onboarding/locations');
}
```

## Legacy tenant backfill

After schema migration, manually backfill the 6 legacy tenants:

```sql
UPDATE tenants SET legacy=1, subscription_status='legacy'
WHERE id IN (
  -- PhatBuns, Burger & Sauce, Boo Burger, Henny's Chicken, Drip Chicken, Halal Editions
  -- IDs to be filled in based on actual tenant rows
);
```

Run via `mcp__turso-cloud__execute_query` (per `notion-task-creation` memory — never `cat | turso db shell`).

## `/onboarding/support` page

Visible disclaimer at the top:

> Ad account access is managed by Meta — Superpulse can't fix login or Business Manager issues directly. We can point you to resources, or onboard you ourselves for a one-off fee.

Three cards:

1. **Free resources**
   - "Watch how to set up your Facebook Business Manager"
   - Links to YouTube tutorials (TBD: pick 2-3 quality ones)

2. **Contact Meta support**
   - "Speak directly with Meta's support team"
   - Link: https://business.facebook.com/business/help

3. **We'll do it for you — £90**
   - "One of our team will jump on a call and handle it for you completely"
   - Button: triggers Stripe Checkout for `STRIPE_PRICE_ONBOARDING_HANDHOLD` (one-off £90)
   - On success: book a Calendly link for the onboarding call

## Verification

- `/pricing` renders single tier.
- `FIRSTMONTHFREE` promo code zeroes out first-month total in Stripe Checkout (test with `4242 4242 4242 4242`).
- Webhook for `checkout.session.completed` upserts tenant row with `subscription_status='active'` and writes audit event.
- Dashboard layout redirects unpaid users to `/pricing`.
- Legacy tenants (`legacy=1`) bypass redirect and render dashboard directly.
- `/onboarding/support` renders 3 cards with disclaimer.
- £90 handhold checkout completes and redirects to Calendly.

## Local testing

```bash
# In one terminal:
cd superpulse
npm run dev

# In another terminal:
stripe listen --forward-to localhost:3000/api/webhook/stripe

# Replay events:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

Keep `stripe listen` running while testing the full flow on localhost.
