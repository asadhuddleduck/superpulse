# Heavenly Desserts Proposal — Full Context for QA Loop

**Last updated:** 2026-05-01
**Status:** v4.1 SHIPPED — live on production
**Live URL:** https://www.superpulse.io/proposal/heavenly-desserts-2026-04-30 (robots noindex, nofollow)
**Local dev:** http://192.168.1.101:3002/proposal/heavenly-desserts-2026-04-30 (`PORT=3002 npm run dev`)

This file exists so a fresh Claude session can pick up the proposal QA loop without re-litigating decisions. Everything here is locked unless the user explicitly overrides.

---

## What this is

A proposal page for Heavenly Desserts (~62 UK dessert chain locations) pitching Superpulse — a quiet system that takes the Instagram posts they already make and shows them to nearby people, again and again, every week. The whole pitch is: same content, more local exposure, less than 1% of their rent.

**Audience:** Sophie Page (Head of Marketing) reads it first; Mohammad Imran (founder/co-director) signs off.
**Distribution:** Sent privately by an intermediary partner. Robots noindex. No public link, no SEO.

---

## Core copy direction (locked)

- **Tone:** 5th-grade English. Clever rhythm preserved (think "We just stop the post from dying", "While you sleep") but every word simple. No corporate-speak.
- **No "ads" word** unless absolutely necessary. Reframe as "we show the post", "your post runs", "in front of locals".
- **No client name-drops** in the body. The logo strip in the hero is the ONLY place client names appear (Burger & Sauce, PhatBuns, GDK, Boo, Burgshake, Drip Chicken, Halal Editions, Shakedown, Dough Club, Chai Green). GDK featured first as the largest brand. Reason: some current clients have paused/churned and we don't want to provoke them by naming them in active marketing.
- **No em-dashes anywhere** (—). Use periods or commas. En-dashes (–) for ranges should also become "X to Y".
- **No prices except £5/day per location** + the "less than 1% of your rent" anchor. SuperPulse SaaS pricing (£300/mo + VAT) lives in our back pocket; never mentioned on the page.
- **No CTA button.** Final slide is "Reply to your partner. We'll take it from there." Soft, no urgency, no link.
- **No pilot-agreement language.** No "1 page no lawyers." This is software; they reply, we onboard.
- **No fake scarcity.** No countdown timers. The Meta API quota point ("we onboard 1-2 chains a month") was useful in earlier drafts but is dropped in v4 to keep the deck simple. Can come back if needed.
- **No "AI" word in any IG screen-record VO.** Page itself can say "AI" sparingly if needed. v4 currently avoids the word entirely.
- **No fabricated quotes.** Real NPS only. v4 avoids quotes altogether and shows numbers instead.
- **Walk-in conversion ratios are forbidden.** We measure profile visits at 7p, never walk-ins. "Walk-in conversion is your shop floor's job."
- **Big-promise hero (locked):** "How to put Heavenly Desserts in front of 3.4 million locals next month, for less than 1% of your rent. Without making a single new piece of content."

---

## Numbers we WILL claim (with sources)

- **7p** per local profile visit (measured across 38+ Superpulse client locations, 90 days ending 30 April 2026)
- **~55K** locals reached per shop, per month (PhatBuns derived: 1M+ impressions / 18 sites)
- **£2.18** cost to reach 1,000 locals (was "CPM" — relabelled per user direction)
- **100%** of clients ran a 2nd campaign after their 1st (replaces "0% churn since day one" — we've had churn recently, so this stat is the honest stand-in)
- **80%** of clients have run more than 10 campaigns (fine print: "Stats reflect our full AI Ad Engine including AI content. Every chain starts with Superpulse.")
- **5x cheaper** than the published 18p to 35p UK food cost-per-engagement benchmark
- **3.4M** locals reached in month 1 across 62 sites (62 × ~55K)
- **40M+** locals reached across the year
- **10K to 55K** new local followers within 3 months (maths: £9,300/mo × 3 months ÷ 50p–£3 per follower)
- All followers framed as "within walking or driving distance of a Heavenly Desserts. Minutes from a craving to a counter."

## Numbers we WON'T claim

- Per-site walk-in count (no POS data)
- Follower-to-walk-in conversion ratio (never measured; Google's "76% near-me" stat is for SEARCH intent, different funnel)
- Direct revenue attribution per site

---

## v4 slide structure (locked)

| # | Slide | Visual | Key copy |
|---|---|---|---|
| 1 | Hero | LogoStrip (real client logos, GDK first) | Big-promise headline + subhead about quiet system |
| 2 | Snapshot | 4-stat grid + HD berry-tart photo | "What this could look like for your 62 shops." Stats: 3.4M, 40M+, 10K-55K, Minutes |
| 3 | Problem | `GhostPostFade` looping infographic (post fades over 24-hour cycle) | "You spend a fortune on every post. Most of it dies in 24 hours." |
| 4 | Fix | `PulsingRadius` looping infographic (viridian rings pulsing from a shop pin) | "We show your post to nearby people, again and again, every week." |
| 5 | How It Works | `PathOfLight` looping infographic (spark travelling between 3 dots) + 3 numbered cards + HD flatbreads photo | "Three quiet steps. Zero hires." Steps: You post / Superpulse picks the winners / Locals see it. Then see it again. |
| 6 | Numbers | 4-stat grid + `CounterTickUp` live counter ("Locals reached today, across our network") | "The numbers, plain and simple." |
| 7 | What You Get | Big £5/day card + 3-bullet "what's included" + HD violet-cake photo | "Less than 1% of your rent." Bullets: winning posts shown weekly / founder direct line + monthly review / clean local data by postcode |
| 8 | Final Word | HD Tokyo storefront photo + closing line | "Reply to your partner. We'll take it from there." |

---

## Looping infographic primitives (always-on, no scroll triggers)

All live in `superpulse/src/components/scroll/`:

- **`GhostPostFade`** — IG post tile fades from full colour to ghost-grey over a 6s loop. Choreography: 0–4.8s post fades + ticker counts 00 → 24; 4.8–5.7s post stays dead, 💀 emoji fades in scaled, ticker holds at HOUR 24 OF 24; 5.7–6s snap back to alive. Pure CSS — keyframes for fade, skull, and ticker (CSS-only stepped column of 25 lines, no React state).
- **`PulsingRadius`** — Viridian rings pulsing outward from a centre pin (3s cycle, staggered every 1s) over a stylised local-area map underlay (street grid + block shapes + vignette). SVG `<animate>`.
- **`PathOfLight`** — Three station dots connected by a thin line; sandstorm spark travels between them via SVG `<animateMotion>`. Step labels: "You post / Superpulse picks / Locals see it."
- **`CounterTickUp`** — JS number counter (uses React useEffect/setInterval) for the "Locals reached today" live counter on the Numbers slide.
- **`PhotoConveyor`** — Left-scrolling marquee of all 6 HD photos at uniform 4:5 portrait ratio. Used only on slide 2. CSS keyframe `translate3d(0) → translate3d(-50%)` over 32s, track duplicated for seamless loop, mask-image fade on both edges.

These primitives REPLACE the v3 attempt at scroll-in text animations, which were the source of all the glitchiness complaints. Text now has zero animations whatsoever.

### CRITICAL: keep keyframes in `proposal.css`, not styled-jsx

Next 16 + Turbopack dev mode has a styled-jsx scoping/HMR quirk where `@keyframes` blocks inside `<style jsx>` sometimes don't resolve (the `animation-name` is mangled but the keyframe is renamed in a way that doesn't match). **All looping animations must live in `superpulse/src/app/proposal/proposal.css`** (scoped to `.proposal-root`). Components apply animations via stable class names (`.proposal-conveyor-track`, `.proposal-ghost-tile`, `.proposal-ghost-skull`, `.proposal-ghost-clock-track`).

Same applies to React-state-based timers (e.g. earlier `useEffect`/setInterval ticker): broken HMR can prevent client hydration entirely on user devices, leaving such timers frozen. Prefer pure-CSS where the loop allows it (the hour ticker is now a 25-row CSS step animation). React state is fine for `CounterTickUp` because it lives on the Numbers slide and Asad confirmed it works on his phone — but new motion primitives should default to CSS first.

---

## Old primitives still in `src/components/scroll/` but UNUSED in v4.1

These are kept around in case future iterations want them but are not imported anywhere in the current page:

`Accordion`, `AccordionItem`, `AnimatedCounter`, `BreathingButton`, `CounterStrip`, `HorizontalHairline`, `IntrigueBullet`, `KineticHeadline`, `LenisProvider`, `LiveDot`, `MapWithDots`, `Marquee`, `MaskedReveal`, `NotificationStack`, `OfferReveal`, `Parallax`, `ProofTile`, `RampVisualisation`, `RevealOnScroll`, `ScrollPinnedSection`, `SignatureDrawIn`, `StrikethroughNumber`, `SwitchOnCascade`, `Timeline`, `TimelineStep`.

`SectionVisibilityObserver.tsx` is also still mounted (in `layout.tsx`) but its `.is-visible` class no longer triggers any animation — the CSS that used it was deleted in v4. Safe to leave; consider removing in a future cleanup.

---

## Photos (locked v4.1 — 2026-05-01)

All 6 HD photos appear in ONE place only: a left-scrolling conveyor on
slide 2 (Snapshot), rendered by `PhotoConveyor` in
`superpulse/src/components/scroll/PhotoConveyor.tsx`. Photos render at
natural portrait aspect ratio, ~170px tall, with mask-image fade on
both edges. The track is duplicated for a seamless loop (~38s cycle).

NO photos on any other slide. Hero, Problem, Fix, How It Works,
Numbers, What You Get, and Final Word are all photo-free. The conveyor
on Snapshot is the single visual-texture moment for the brand.

Files at `superpulse/public/heavenly-desserts/`:
- `hd-1-flatbreads.png` (1568×2258)
- `hd-2-mango-chilli.png` (1432×2382)
- `hd-3-berry-tart.png` (1356×2410)
- `hd-4-tokyo.png` (1756×2312)
- `hd-5-pancakes.png` (1370×2396)
- `hd-6-violet-cake.png` (1364×2372)

---

## Layout invariants (DO NOT CHANGE)

- `.proposal-root` is the scroll-snap container: `scroll-snap-type: y mandatory; height: 100vh; overflow-y: scroll`
- Each `<section>` is exactly `100vh / max-height: 100vh / overflow: hidden` — every slide MUST fit one viewport. NO content scrolling within a slide.
- `.proposal-slide-inner` is flex-centred inside each section
- Mobile-first; tested on iPhone 14 Pro 390×844
- Brand: dark theme (#000), viridian #1EBA8F, sandstorm #F7CE46, premium easing `cubic-bezier(0.16, 1, 0.3, 1)`
- All scoped CSS lives in `superpulse/src/app/proposal/proposal.css` (`.proposal-root`-prefixed). Do NOT touch `superpulse/src/app/globals.css`.

---

## QA checklist for any future change

After any edit:

1. `cd superpulse && npx tsc --noEmit` exits 0
2. `cd superpulse && npm run build` exits 0
3. `curl -s -o /dev/null -w "%{http_code}\n" http://192.168.1.101:3002/proposal/heavenly-desserts-2026-04-30` returns 200
4. `grep -rE "—|–" src/app/proposal/heavenly-desserts-2026-04-30/sections/` returns nothing in body strings (em/en dashes still allowed in code comments)
5. `grep -rE "\bAI\b|\bads?\b" src/app/proposal/heavenly-desserts-2026-04-30/sections/` — flag any new uses for review (we minimise these words)
6. `grep -rE "Burger & Sauce|PhatBuns|Boo Burger|Shakedown" src/app/proposal/heavenly-desserts-2026-04-30/sections/` — should ONLY appear in `LogoStrip.tsx`
7. Playwright: every slide fits one viewport at 390×844, 768×1024, 1440×900. Zero overflows. Console "errors" are HMR WebSocket only — ignore those.
8. Deploy: `cd superpulse && npx vercel --prod --yes`. Live URL is www.superpulse.io (root redirects 307 → www).

---

## Working mode (autonomous)

- **Start every QA loop with Playwright MCP immediately.** Don't ask first.
- **Fix everything identified in one pass.** No "want me to fix these in order or pick first?" — just do them all and report back.
- After fixes: re-run typecheck + Playwright at 390×844 before reporting.

---

## Locked user preferences from this session (relevant to QA)

- Photos sprinkled "here and there to switch things up", not systematised
- Final word slide is "Reply to your partner. We'll take it from there." — no button, no urgency
- Cost surfaces as "£5/day per location" big + "less than 1% of your rent" anchor
- Looping animations stay; ALL text scroll-in animations are removed
- 5th-grade reading level for all body copy
- No re-litigating: avoid name-dropping clients in body, avoid em-dashes, avoid AI/ads jargon
- IG VO (if recorded later) must be humble + value-led + work for smaller-business audience too
- 4-week ramp / Meta-quota scarcity / objection-handler / why-not-boost slides were all dropped from v4 — only re-add if user explicitly asks

---

## Reference docs in workspace root

- `HD-PITCH-COPY.md` — earlier copy iterations (mostly superseded by v4 but historical record of what was tried)
- `HD-PITCH-NUMBERS.md` — defensibility table for all numerical claims
- `HD-PITCH-RECON.md` — Heavenly Desserts intel (sites, decision-makers, social presence)
- `HD-PITCH-DESIGN.md` — earlier animation/visual brief (v4 supersedes most of this)
- `HD-PITCH-BOUT1-v0.md` — initial integration doc
- `HD-PITCH-QA-REPORT.md` — earlier QA findings

Notion task: https://www.notion.so/35284fd7bc4e81cb99c2d37957d4cdad
