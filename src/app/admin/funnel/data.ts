// Static map of the SuperPulse customer journey — pages, copy, flow, decisions.
// Sourced from a full code read (Jun 2026). This is the content the founder
// reviews; live numbers come from metrics.ts. Update when funnel copy/flow changes.

export interface FunnelStep {
  n: number;
  id: string;
  title: string;
  route: string;
  purpose: string;
  copy: string[];
  cta: string;
  next: { condition: string; target: string }[];
  writes: string[];
}

export interface AppState {
  id: string;
  title: string;
  route: string;
  signal: string;
  whatHappens: string;
  next: string[];
}

// The public ad funnel: where cold Meta-ad traffic lands and what happens next.
export const FUNNEL: FunnelStep[] = [
  {
    n: 1,
    id: "waitlist-form",
    title: "Waitlist form",
    route: "/waitlist",
    purpose:
      "Top of funnel. Where Meta ads send people. Captures the lead, fires the Meta Lead event, sends a welcome email, and moves them on. Free, no card.",
    copy: [
      "Eyebrow: Now letting local businesses in",
      "Headline: Keep posting like you do. We turn it into locals walking in.",
      "Sub: You post on Instagram like you already do. We turn the right posts into local ads that find people on your doorstep. Restaurants, barbers, dentists, clinics, gyms, beauticians, opticians.",
      "Card: Free to join · No card needed — Get on the waitlist",
      "Fields: First name · Business email · Mobile (UK) · Instagram handle",
      "Fine print: We only use these details to talk to you about SuperPulse. No lists, no spam, ever.",
    ],
    cta: "Put me on the list",
    next: [
      { condition: "Form submits OK", target: "→ Qualifier (/waitlist/qualify)" },
      { condition: "Bad email / phone / IG handle", target: "Stays on form, shows error" },
    ],
    writes: [
      "Turso: waitlist row (upsert by email) + UTM first/last touch",
      "Meta Pixel + CAPI: Lead event",
      "Email: welcome + enrols in the 10-week nurture sequence",
      "(Slack signup alert removed 12 Jun 2026 — Slack is demo requests + purchases only)",
    ],
  },
  {
    n: 2,
    id: "qualify",
    title: "Qualifier (quiz only)",
    route: "/waitlist/qualify",
    purpose:
      "Asks the questions, then BRANCHES on whether the lead qualifies (IG business profile + at least 2 of: posts weekly / has Business Manager / has run ads). Qualified leads go straight to booking a call (the priority — get them on a call ASAP). Non-qualified leads get the £27 review on its own and are never offered the call. Locations no longer gate anything (changed 14 Jun 2026).",
    copy: [
      "Headline: Four quick questions. Helps us move you up the list.",
      "Fields: Business type · How many locations?",
      "Ticks: Has IG business profile · Posts weekly · Has Meta Business Manager · Has run Meta ads",
      "Fine print: Takes about 30 seconds. You're on the waitlist either way.",
    ],
    cta: "Submit my answers",
    next: [
      { condition: "Qualified (any locations)", target: "→ Book a call (/waitlist/demo)" },
      { condition: "Not qualified", target: "→ £27 offer only (/waitlist/offer)" },
      {
        condition: "Re-take after already booking a call",
        target: "→ £27 offer, call-booked framing (?demo=1), no second pitch",
      },
    ],
    writes: [
      "Turso: qualifier_responses (answers + qualified flag + demo_qualified still stored). Never touches a recorded demo/audit choice.",
      "Slack: '🎯 New qualified SuperPulse lead' the first time a lead crosses into qualified (never re-fires on re-takes)",
      "Meta Pixel + CAPI: CompleteRegistration",
    ],
  },
  {
    n: 3,
    id: "demo",
    title: "Book a call (qualified leads)",
    route: "/waitlist/demo",
    purpose:
      "Where qualified leads land straight from the quiz (the call is the priority). Inline Cal.com calendar, prefilled with their name + email — they pick a slot and it drops into the founder's connected calendar. Cal sends the invite + reminders. The Cal webhook (/api/webhook/cal) records the booking server-side. After booking they go to the £27 + £97 ladder.",
    copy: [
      "Eyebrow: You qualified · A call with the team",
      "Headline: Good news. Pick a time that suits you.",
      "Card: One to one call · Free · No card needed",
      "Sub: Grab a slot below, the team hops on a short call, looks at your Instagram with you, 15 to 20 minutes.",
      "Fine print: You pick the time, it drops into our calendar, invite + reminder by email. Nothing to pay.",
    ],
    cta: "Pick a slot in the calendar  /  No thanks, keep my spot on the waitlist",
    next: [
      { condition: "Picks a slot (Cal bookingSuccessful)", target: "→ £27 offer, call-booked framing (?demo=1)" },
      { condition: "No thanks", target: "→ £27 offer, standard framing" },
    ],
    writes: [
      "Turso: demo_scheduled_at + cal_booking_uid + demo_booking_status='booked' (via Cal webhook); demo_requested_at set once",
      "Slack: '📞 SuperPulse demo BOOKED' with the booked time, on the first delivery only (idempotent on uid)",
      "Meta Pixel + CAPI: Schedule (browser + server, deduped on booking uid)",
      "Email: branded pre-call resources email; Cal sends the calendar invite + reminders",
    ],
  },
  {
    n: 4,
    id: "offer",
    title: "£27 review offer (two framings)",
    route: "/waitlist/offer",
    purpose:
      "The £27 Instagram review (same product as the old inline audit offer). Leads who booked a call see it as a demo upgrade ('read it before we talk', ?demo=1); everyone else as something to do while they wait. This is the start of the post-booking £27 → £97 ladder. Email CTAs deep-link here directly.",
    copy: [
      "Demo framing (?demo=1): One thing before your demo. Want your Instagram reviewed first? · Upgrade your demo · £27 · Inbox in 24h",
      "Waitlist framing: You're on the list. We'll let you know when we can take you on. · While you wait · £27 review · Inbox in 24h",
      "Bullets: 3 posts to put money behind first · posting vs fast-growing local businesses · 5 caption and hook fixes · money back if we miss 24h",
      "Fine print: Card only charged again if you add the £97 Loom next.",
    ],
    cta: "Yes, add/send the £27 review  /  No thanks",
    next: [
      { condition: "Yes → Stripe £27 checkout", target: "→ Stripe Checkout £27" },
      { condition: "No (call booked)", target: "→ Thank-you (booked variant)" },
      { condition: "No (no call)", target: "→ Thank-you (skipped / priority)" },
    ],
    writes: [
      "Turso: audit_offer_choice on qualifier_responses",
      "Meta Pixel + CAPI: InitiateCheckout (shared event id, deduped)",
      "Stripe (if Yes): £27 Checkout session, card saved for one-click £97",
    ],
  },
  {
    n: 5,
    id: "stripe-27",
    title: "Stripe Checkout — £27",
    route: "checkout.stripe.com (hosted)",
    purpose:
      "Stripe's own page. Takes the £27 + UK VAT and saves the card so the £97 can be charged in one click on the next page.",
    copy: ["Stripe-hosted. Line item: SuperPulse £27 audit. VAT auto-applied. Receipt emailed."],
    cta: "Pay £27",
    next: [
      { condition: "Paid", target: "→ £97 upsell (/waitlist/upsell)" },
      { condition: "Cancelled", target: "→ back to £27 offer (framing preserved)" },
    ],
    writes: [
      "Stripe records the payment → app webhook writes audit_purchases (tier=audit-27)",
      "Buyer gets a branded SuperPulse confirmation email (audit PDF in 24h) — added 1 Jun 2026",
    ],
  },
  {
    n: 6,
    id: "upsell",
    title: "£97 Loom upsell",
    route: "/waitlist/upsell",
    purpose:
      "One-time offer after the £27: a personal Loom walkthrough for +£97, charged one-click on the saved card. Fires the £27 Purchase pixel on load.",
    copy: [
      "Eyebrow: Payment received · Audit queued",
      "Headline: One last thing. Want it walked through?",
      "Sub: Want one of the team to record a 5–7 minute Loom, sat looking at your account, walking every finding through in plain English?",
      "Card: Personal Loom · +£97 on top of your audit",
      "Fine print: £97 charged to the card you just used. Loom + audit inside 24h or money back.",
    ],
    cta: "Yes, add the Loom · £97  /  No thanks, just send the £27 audit",
    next: [
      { condition: "Buy (one-click)", target: "→ Thank-you (Loom + audit)" },
      { condition: "Card needs 3D-Secure", target: "→ Stripe Checkout £97 (fallback)" },
      { condition: "Skip", target: "→ Thank-you (audit only)" },
    ],
    writes: [
      "Meta Pixel: Purchase £27 (on load)",
      "Stripe: one-click £97 PaymentIntent on saved card → audit_purchases (tier=audit-97)",
      "Meta CAPI: Purchase £97",
    ],
  },
  {
    n: 7,
    id: "done",
    title: "Thank-you (5 variants)",
    route: "/waitlist/done",
    purpose:
      "End of the funnel. Shows one of 5 messages depending on what they did. Fires the £97 Purchase pixel if they bought it. Purchase variants append the demo line when a demo was requested.",
    copy: [
      "Demo requested (no purchase): 'Demo request received.' Someone will be in touch within the next few hours.",
      "Priority (qualified, skipped): 'You're on the priority list.' You'll hear from us before we open to the public.",
      "Standard (skipped): 'You're on the list.' We'll be in touch before we open to the public.",
      "Bought £97: 'Loom and audit booked.' Both land in your inbox inside 24h.",
      "Bought £27: 'Audit booked.' Your audit PDF lands inside 24h.",
    ],
    cta: "(none — terminal page)",
    next: [{ condition: "End of funnel", target: "—" }],
    writes: ["Meta Pixel: Purchase £97 (if upsell bought). No DB writes (webhook is authoritative)."],
  },
];

// Out-of-band: the Stripe webhook is the authoritative writer of all money events.
export const WEBHOOK_NOTE = {
  title: "Stripe webhook (behind the scenes)",
  route: "/api/webhook/stripe",
  detail:
    "Stripe calls this server-to-server on every payment. It writes the real purchase records (audit_purchases), fires the CAPI Purchase event, and Slack-alerts every money event (£27, £97, refunds, disputes, new £300/mo subs, failed payments), and (since 1 Jun 2026) emails the buyer a branded SuperPulse audit confirmation (PDF in 24h). MUST point at www.superpulse.io (the apex silently drops events — cost 3 lost payments on 29 May).",
};

// The SaaS side: what happens after someone subscribes to the £300/mo product.
// (Separate from the audit funnel above. Almost nobody is here yet — 1 legacy tenant.)
export const APP_JOURNEY: AppState[] = [
  {
    id: "pricing",
    title: "Pricing → Subscribe",
    route: "/pricing",
    signal: "No active subscription yet",
    whatHappens:
      "£300/mo + VAT, single tier. FIRSTMONTHFREE coupon can zero month 1. Subscribing opens a Stripe subscription checkout.",
    next: ["Paid → Connect Instagram"],
  },
  {
    id: "pending_oauth",
    title: "Connect Instagram",
    route: "/onboarding/connect",
    signal: "status=pending_oauth (paid, no Meta token yet)",
    whatHappens:
      "After payment the tenant is created. They click 'Continue with Facebook' and grant access. We store an encrypted token.",
    next: ["→ Pick Page (if 2+) / Pick ad account / Live"],
  },
  {
    id: "pending_page_selection",
    title: "Pick Page",
    route: "/onboarding/select-page",
    signal: "status=pending_page_selection (only if 2+ Pages)",
    whatHappens: "Choose which Facebook Page + linked Instagram account SuperPulse boosts from.",
    next: ["→ Pick ad account / Live"],
  },
  {
    id: "pending_ad_account",
    title: "Pick ad account",
    route: "/onboarding/select-ad-account",
    signal: "status=pending_ad_account (no ad account bound)",
    whatHappens: "Choose which Meta ad account the spend runs on. Then status flips to active.",
    next: ["→ Live dashboard"],
  },
  {
    id: "active",
    title: "Live (dashboard)",
    route: "/dashboard",
    signal: "status=active + token + paying (or legacy)",
    whatHappens:
      "Dashboard renders: last scan, posts boosted, campaigns live, spend. The boost crons process this tenant. (scan-posts cron is frozen as of 3 May, being reworked.)",
    next: ["→ past due / cancelled"],
  },
  {
    id: "past_due",
    title: "Payment failed",
    route: "/pricing?reason=past_due",
    signal: "subscription_status=past_due",
    whatHappens: "Bounced to pricing with a red banner. Re-entering card returns them to live.",
    next: ["→ Live / Cancelled"],
  },
  {
    id: "canceled",
    title: "Cancelled",
    route: "/pricing",
    signal: "subscription_status=canceled",
    whatHappens: "All their Meta campaigns auto-pause. Re-subscribing reactivates.",
    next: ["→ Live (on resubscribe)"],
  },
];

// What the founder sees in Stripe/Resend that is NOT SuperPulse.
export const NOT_SUPERPULSE = {
  title: "AI Ad Engine Trial — NOT part of SuperPulse",
  detail:
    "The 'AI Ad Engine Trial' (£497) and 'AI Ad Engine Unlimited' you see in Stripe are the OLD Huddle Duck agency offer (sold at start.huddleduck.co.uk). They live in the SAME Stripe account and send from the SAME Resend account (huddleduck.co.uk) as SuperPulse, which is why everything shows up mixed together. None of it is part of the SuperPulse waitlist funnel. FIXED 1 Jun 2026: until then, the shared-account landing-page webhook was wrongly sending SuperPulse £27 audit buyers an 'AI Ad Engine Trial onboarding' email and firing a fake £497 Meta Purchase event. It's now guarded to ignore SuperPulse purchases. SuperPulse now sends its own correct audit confirmation. If you see those old AI Ad Engine emails to a SuperPulse buyer dated before 1 Jun, that's the cause.",
};
