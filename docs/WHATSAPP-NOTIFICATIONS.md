# WhatsApp demo-call notifications

Sends a booking **confirmation** the moment a qualified owner self-books a demo, plus **pre-call reminders** ~24h and ~1h before, over WhatsApp. Email + Slack + the Cal.com calendar invite all still fire as before — WhatsApp is the extra phone channel because restaurant owners live on their phones, not email.

## How it's wired (code is shipped, gated off)

- **Sender:** `src/lib/whatsapp.ts` — WhatsApp Cloud API, raw fetch, best-effort (never throws into the caller). UK phone → E.164 via `toE164()`. No-op unless `WHATSAPP_NOTIFICATIONS_ENABLED=1`.
- **Confirmation:** `src/app/api/webhook/cal/route.ts` `BOOKING_CREATED` sends the confirmation template to the phone we already hold (from the `waitlist` row), right after the existing email.
- **Reminders:** `src/app/api/cron/demo-reminders/route.ts` (Vercel cron `*/15 * * * *`) scans booked future calls and sends the 24h / 1h reminder templates once each, tracked in `qualifier_responses.reminder_24h_sent_at` / `reminder_1h_sent_at`.
- **Guaranteed channel stays email.** A WhatsApp failure (no WhatsApp on that number, undeliverable, not yet set up) is logged and ignored — the booking, email, Slack and CAPI are unaffected.

**Business-initiated WhatsApp messages must use a Meta-approved template.** The copy below lives in Meta, not in our code — we only pass the template name + the two body variables `{{1}}` (first name) and `{{2}}` (date/time, e.g. "Thursday 19 June, 2:30 pm").

## Templates to submit (Meta → WhatsApp Manager → Message templates)

Category **Utility** (transactional), language **English (UK) / en_GB**. On submission, set the sample values so Meta can review: `{{1}}` = `Sara`, `{{2}}` = `Thursday 19 June, 2:30 pm`.

**1. `demo_booking_confirmation`**
> Hi {{1}}, you're booked in with SuperPulse for {{2}}. On the call we'll look at your Instagram together and show you exactly how we'd run it for your place. About 15 to 20 minutes, nothing to pay. The calendar invite is in your email if you ever need to move it.

**2. `demo_reminder_24h`**
> Hi {{1}}, quick reminder: your SuperPulse call is {{2}}. Have your Instagram handy so we can look at it together. See you then.

**3. `demo_reminder_1h`**
> Hi {{1}}, your SuperPulse call is coming up at {{2}}. Have your Instagram open and we'll get straight to it. Talk soon.

(Voice rules honoured: no "AI", no em/en-dashes, owner-to-owner. If you rename a template in Meta, just change the matching env var below.)

## One-time Meta setup (your actions — I can't create accounts or approve templates)

1. **Add WhatsApp to a Meta app.** Recommend the existing **SuperPulse** app (ID `1962215474400192`) → Products → add **WhatsApp**. This creates a WhatsApp Business Account (WABA) and a free **test number** for dev.
2. **Sender number.** Use the test number to trial it, or register a real business number (a number NOT already on a personal WhatsApp). Copy its **Phone number ID** (WhatsApp → API Setup).
3. **Permanent token.** Business Settings → System users → add a system user → generate a token with `whatsapp_business_messaging` + `whatsapp_business_management`. (The temporary 24h token from API Setup is fine for a first test.)
4. **Submit the 3 templates** above and wait for approval (minutes to ~1-2 days). With the test number you can message only pre-added recipient numbers until the number is live.
5. **Set env vars** (Vercel + `.env.local`), then flip the flag.
6. **Apply the schema columns** if not already: `reminder_24h_sent_at`, `reminder_1h_sent_at` on `qualifier_responses` (see `src/lib/schema.sql`).

## Env vars

```
WHATSAPP_NOTIFICATIONS_ENABLED=1            # master switch; unset = total no-op
WHATSAPP_PHONE_NUMBER_ID=...                # from WhatsApp API Setup
WHATSAPP_TOKEN=...                          # permanent system-user token
WHATSAPP_GRAPH_VERSION=v21.0                # optional, defaults to v21.0
WHATSAPP_TEMPLATE_LANG=en_GB                # optional, defaults to en_GB
WHATSAPP_TEMPLATE_DEMO_CONFIRMATION=demo_booking_confirmation
WHATSAPP_TEMPLATE_DEMO_REMINDER_24H=demo_reminder_24h
WHATSAPP_TEMPLATE_DEMO_REMINDER_1H=demo_reminder_1h
```

## Go-live + test

1. Set the env vars and `WHATSAPP_NOTIFICATIONS_ENABLED=1` in Vercel, redeploy.
2. With the test number, add your own mobile as an allowed recipient in WhatsApp API Setup.
3. Book a test slot on `/waitlist/demo` (use a lead row whose `phone` is your mobile) → you should get the WhatsApp confirmation within seconds. Check the Vercel function logs for `[whatsapp]` if not.
4. Reminders: the cron only fires inside the 24h/1h windows; to test fast, book a slot ~80 min out (gets the 1h reminder on the next 15-min tick) or temporarily insert a near-future `demo_scheduled_at`.

## Notes

- Why not Cal.com's native SMS/WhatsApp Workflows: needs a paid Teams plan, runs on credits where UK messages cost Twilio + an 80% markup, and WhatsApp copy can't be customised. Firing from our own webhook is cheaper at UK rates, fully ours to word, and works on free Cal.com. (Verified against cal.com docs/pricing, 17 Jun 2026.)
- The Cal webhook only fires at booking time, which is why reminders are a separate cron keyed off `demo_scheduled_at`.
