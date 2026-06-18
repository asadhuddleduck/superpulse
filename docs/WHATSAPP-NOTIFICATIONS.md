# WhatsApp demo-call notifications

Sends a booking **confirmation** the moment a qualified owner self-books a demo, plus **pre-call reminders** ~24h and ~1h before, over WhatsApp — **only to leads who explicitly opted in**. Email + Slack + the Cal.com calendar invite still fire as before; WhatsApp is the extra phone channel.

> Built on the verified findings of the WhatsApp-approval research (17 Jun 2026): Cloud API direct, no BSP, no App Review, no screencast — sending from our own business-verified WABA. The real gate is **opt-in**, not Meta approval.

## How it's wired (code shipped, gated off)

- **Sender:** `src/lib/whatsapp.ts` — WhatsApp Cloud API, UK→E.164, best-effort, no-op unless `WHATSAPP_NOTIFICATIONS_ENABLED=1`.
- **Opt-in:** captured by an unchecked checkbox on the shared `/waitlist` form → `waitlist.whatsapp_opt_in` (+ `whatsapp_opt_in_at`). **Every WhatsApp send is gated on this flag.** Email is unconditional.
- **Confirmation:** `api/webhook/cal` `BOOKING_CREATED` (and re-confirm on `BOOKING_RESCHEDULED`) → sends only if `phone && opted-in`.
- **Reminders:** `api/cron/demo-reminders` (`*/15`) — query filters `whatsapp_opt_in = 1`; sends ~24h + ~1h templates once each, tracked in `qualifier_responses.reminder_24h_sent_at` / `reminder_1h_sent_at`.

## No App Review / no screencast

Sending business-initiated WhatsApp templates from **our own** business-verified portfolio's WABA needs **no Meta App Review and no screencast**. App Review for `whatsapp_business_messaging` is only triggered when an app messages on behalf of *other* businesses (BSP / Embedded Signup) — out of scope here. (If we ever resell WhatsApp to clients, that's a different app and would need a screencast — self-producible later from Playwright screen-recording. Not now.)

## Opt-in is mandatory (the real blocker)

WhatsApp policy, verbatim: *"You may only contact people on WhatsApp if (a) they have given you their mobile phone number; and (b) you have received opt-in permission… confirming that they wish to receive subsequent messages."* A number on a form is **not** opt-in. Messaging non-opted-in numbers → blocks/reports → quality downgrade → number ban.

- The `/waitlist` form now has an **unchecked** checkbox naming Huddle Duck/SuperPulse + WhatsApp + message types + STOP opt-out. Consent + timestamp stored on `waitlist`.
- **Any number captured before this checkbox existed has no valid opt-in — do not message it.**
- Honour STOP/opt-out by setting `whatsapp_opt_in = 0` for that email.
- UK GDPR: transactional sends rest on contractual necessity / legitimate interest, but that does NOT replace Meta's opt-in (separately enforced). Privacy policy should name WhatsApp as a channel; the WABA needs a valid privacy-policy URL.

## Templates to submit (WhatsApp Manager → Message templates)

Category **Utility**, language **English (UK) / `en_GB`** (send that exact code or you hit error 132001). Positional `{{n}}` vars, each wrapped in static text. No promo wording (keeps it UTILITY). Provide the sample values on submission.

**1. `demo_booking_confirmation`**
> Hi {{1}}, your SuperPulse demo call is booked for {{2}} at {{3}}. We'll call you on {{4}}. Reply RESCHEDULE if you need a different time.

Footer (optional): `Huddle Duck (SuperPulse)` · Samples: {{1}}=`Sarah` {{2}}=`Thursday 19 June` {{3}}=`2:30 PM` {{4}}=`+44 7700 900123`

**2. `demo_reminder_24h`**
> Hi {{1}}, a reminder that your SuperPulse demo call is tomorrow, {{2}}, at {{3}}. We'll call you on {{4}}. Reply RESCHEDULE if the time no longer works.

Samples: {{1}}=`Sarah` {{2}}=`Thursday 19 June` {{3}}=`2:30 PM` {{4}}=`+44 7700 900123`

**3. `demo_reminder_1h`**
> Hi {{1}}, your SuperPulse call is in about an hour, at {{2}}. We'll call you on {{3}}. Reply RESCHEDULE if you need a different time.

Samples: {{1}}=`Sarah` {{2}}=`2:30 PM` {{3}}=`+44 7700 900123`

Subscribe to the `message_template_status_update` + `template_category_update` webhooks to catch approval and any silent re-categorisation. Approval is usually minutes, up to ~48h if a human reviews. Approval is likely, not guaranteed.

## Setup runbook — ToS → first live message

**ASAD** = legal consent / credentials / a number / a decision. **CLAUDE** = automatable in the dev console or code.

1. **[ASAD]** Accept the WhatsApp Business Platform ToS (App → WhatsApp → API Setup). *Hard gate — nothing sends until this is done. We paused here.*
2. **[ASAD]** Decide the sender number — a **fresh dedicated number**, NOT 07832699033 and NOT any number live on consumer WhatsApp or the WhatsApp Business app (a number lives on one surface only).
3. **[ASAD]** Provision the free **test number** (instant) so we can wire + test before the real number exists.
4. **[ASAD]** Add **07832699033** as a test recipient (OTP-verified; read back the code). Test number caps at 5 recipients.
5. **[CLAUDE]** Submit the 3 UTILITY templates **on the real number's WABA** (test-number templates don't port). Wire is already coded.
6. **[CLAUDE]** Send all 3 to 07832699033 end-to-end to confirm rendering + webhook receipt.
7. **[ASAD]** Register the real sender number (SMS/voice OTP → read back code → set 6-digit PIN).
8. **[ASAD]** Confirm the **display name** (brand-aligned: "SuperPulse" / "Huddle Duck", not "Bookings"/"Sales").
9. **[CLAUDE]** Generate a **System User permanent token** (`whatsapp_business_messaging` + `whatsapp_business_management`); store with `phone_number_id`. *Token is a credential — Asad pastes it; Claude never stores it.*
10. **[ASAD]** Add a payment method to the WABA (per-message charges).
11. **[DONE]** Opt-in checkbox is live on `/waitlist` + privacy-policy line (add the privacy line if missing).
12. **[CLAUDE]** Flip `WHATSAPP_NOTIFICATIONS_ENABLED=1`; fire confirmation to the first real opted-in lead; watch quality rating.

## Env vars

```
WHATSAPP_NOTIFICATIONS_ENABLED=1            # master switch; unset = total no-op
WHATSAPP_PHONE_NUMBER_ID=...                # from WhatsApp API Setup (the REAL number)
WHATSAPP_TOKEN=...                          # permanent system-user token (Asad pastes)
WHATSAPP_GRAPH_VERSION=v21.0                # optional
WHATSAPP_TEMPLATE_LANG=en_GB                # optional, defaults en_GB
WHATSAPP_TEMPLATE_DEMO_CONFIRMATION=demo_booking_confirmation
WHATSAPP_TEMPLATE_DEMO_REMINDER_24H=demo_reminder_24h
WHATSAPP_TEMPLATE_DEMO_REMINDER_1H=demo_reminder_1h
```

## Cost (GBP, UK utility)

Per-message model (since 1 Jul 2025), billed on delivery, no BSP markup via Cloud API direct. All 3 sends are business-initiated outside any service window → all 3 paid. Roughly **5–9p per lead** for the full set (UK utility ≈ £0.015–0.03/msg). **Exact UK utility rate unconfirmed** — Meta's pricing page is JS-gated; confirm in WhatsApp Manager before forecasting at volume. (UK marketing ≈ £0.04/msg, rising ~20% on 1 Jul 2026 — only relevant if a template is miscategorised as MARKETING.)

## What does NOT work / top traps

- Sending before ToS acceptance · using the test number in production (5-recipient cap, templates don't port) · a sender number still on consumer WhatsApp.
- Messaging non-opted-in numbers (the top ban risk — now gated in code).
- Marketing creep in a UTILITY template → auto-reclassified to MARKETING. Keep copy factual.
- Variable at body start/end, adjacent variables, placeholder-only bodies, missing samples → rejection.
- URL shorteners / wa.me links → phishing flag (use a full superpulse.io HTTPS link or a URL button).
- Locale mismatch (`en` vs approved `en_GB`) → error 132001.
