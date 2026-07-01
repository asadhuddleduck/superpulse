# SuperPulse Brand Kit

> Quick reference for anyone touching the SuperPulse brand.
> SuperPulse is a **Huddle Duck product** — same colours, same dark aesthetic, lightning bolt instead of duck.
> For full strategy and rationale, see [BRAND-STRATEGY.md](./BRAND-STRATEGY.md).

---

## Colour System

> Identical to Huddle Duck. No deviations.

### Primary Palette (Backgrounds & Surfaces)

| Swatch | Name | Hex | RGB | Usage |
|---|---|---|---|---|
| ![#050508](https://placehold.co/20/050508/050508) | **Void** | `#050508` | `5, 5, 8` | Primary background. The default canvas. |
| ![#111116](https://placehold.co/20/111116/111116) | **Graphite** | `#111116` | `17, 17, 22` | Cards, modals, elevated surfaces. |
| ![#1E1E26](https://placehold.co/20/1E1E26/1E1E26) | **Slate** | `#1E1E26` | `30, 30, 38` | Borders, dividers, subtle separations. |

### Accent Palette

| Swatch | Name | Hex | RGB | Usage |
|---|---|---|---|---|
| ![#F7CE46](https://placehold.co/20/F7CE46/F7CE46) | **Sandstorm Yellow** | `#F7CE46` | `247, 206, 70` | THE brand colour. Lightning bolt, CTAs, hero elements. Warm, energetic. |
| ![#1EBA8F](https://placehold.co/20/1EBA8F/1EBA8F) | **Viridian Green** | `#1EBA8F` | `30, 186, 143` | Active states, metrics, success indicators. The working colour. |
| ![#1EBA8F99](https://placehold.co/20/1EBA8F99/1EBA8F99) | **Viridian 60%** | `#1EBA8F99` | `30, 186, 143, 0.6` | Hover states, secondary indicators. |

### Text Palette

| Swatch | Name | Hex | RGB | Usage |
|---|---|---|---|---|
| ![#F0F0F5](https://placehold.co/20/F0F0F5/F0F0F5) | **White** | `#F0F0F5` | `240, 240, 245` | Headlines, primary body text. Never use pure `#FFFFFF`. |
| ![#8888A0](https://placehold.co/20/8888A0/8888A0) | **Mist** | `#8888A0` | `136, 136, 160` | Secondary text, labels, timestamps. |
| ![#555566](https://placehold.co/20/555566/555566) | **Shadow** | `#555566` | `85, 85, 102` | Placeholders, disabled states. |

### Colour Rules

1. **Sandstorm yellow = identity + action** — the bolt, CTAs, conversion moments, hero elements.
2. **Viridian green = data + status** — active campaigns, metrics, success states, dashboard.
3. **No light mode** — the brand IS dark. Graphite (#111116) is the lightest allowable background.
4. **Match Huddle Duck** — if in doubt, use the same colour Huddle Duck would use.

### CSS Variables (as actually wired)

These live in `src/app/globals.css` under `:root`, and are exposed to Tailwind v4 via the `@theme inline` block in the same file. Names are **flat / unprefixed** (the app already used `viridian`/`sandstorm`, so we kept that and added the rest rather than churn every class to an `sp-` prefix).

```css
:root {
  /* Backgrounds & surfaces */
  --void: #050508;
  --graphite: #111116;
  --slate: #1e1e26;

  /* Accents */
  --sandstorm: #f7ce46;
  --viridian: #1eba8f;
  --viridian-muted: rgba(30, 186, 143, 0.6);

  /* Text */
  --white: #f0f0f5; /* never pure #FFFFFF */
  --mist: #8888a0;
  --shadow: #555566;

  /* Semantic aliases */
  --background: var(--void);
  --foreground: var(--white);
}
```

### Tailwind utilities

Tailwind v4 — there is **no `tailwind.config.js`**. The `@theme inline` block in `globals.css` turns each `--color-*` token into utilities automatically. Use these class names anywhere:

| Token | Utilities |
|---|---|
| Void | `bg-void` |
| Graphite | `bg-graphite` (cards; `/40`–`/50` opacity fine) |
| Slate | `border-slate` (borders/dividers) |
| Sandstorm | `bg-sandstorm` `text-sandstorm` `border-sandstorm` (identity + CTAs) |
| Viridian | `bg-viridian` `text-viridian` `border-viridian` (data/status). `viridian/60` for hover |
| White | `text-white` (already remapped to `#F0F0F5`) |
| Mist | `text-mist` (secondary text/labels) |
| Shadow | `text-shadow` `placeholder:text-shadow` (placeholders/disabled) |

Opacity modifiers work on every token (`bg-viridian/90`, `border-sandstorm/40`). Text on a viridian/sandstorm surface is `text-void`.

> **UI kit:** don't hand-roll buttons/cards/inputs. Import from `src/components/ui/` (`Button`, `Card`, `Input`/`Textarea`/`Label`, `PageHeading`, `Wordmark`, `OnboardingShell`, `OnboardingProgress`, `FadeIn`). These bake in the spacing scale, ≥44px tap targets, and the tokens above.

---

## Typography

### Font Stack

| Role | Font | Weights | Fallback |
|---|---|---|---|
| **Headlines** | Inter | 700 (Bold), 800 (ExtraBold) | `system-ui, -apple-system, sans-serif` |
| **Body** | Inter | 400 (Regular), 500 (Medium) | `system-ui, -apple-system, sans-serif` |
| **Data / Metrics** | JetBrains Mono | 400, 500 | `'SF Mono', 'Fira Code', monospace` |

### Typography Rules

- **All caps:** Labels only (e.g., "PROFILE VISITS"). Never for sentences or headings.
- **Large numbers, small labels:** Metrics at 32-48px, labels at 12-14px in Mist.
- **Line height:** 1.5-1.6 for body text.
- **Letter spacing:** -0.02em on bold headlines for density.

### Installation (as actually wired)

Loaded via `next/font/google` in `src/app/layout.tsx` (self-hosted, no external `<link>`), exposed as CSS vars `--font-inter` / `--font-jetbrains`, and mapped to Tailwind's `--font-sans` / `--font-mono` in `globals.css`. Use `font-sans` (default) for text and `font-mono` for metrics/numbers.

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "700", "800"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });
```

---

## Logo Usage

### The Mark: Lightning Bolt

The SuperPulse mark is a **geometric lightning bolt in sandstorm yellow (#F7CE46)**. It's the product equivalent of Huddle Duck's duck — same visual weight, same simplicity, different symbol.

### Assets

| Asset | File | Dimensions | Use Case |
|---|---|---|---|
| App Icon | `brand/app-icon.jpg` | 1024x1024 | App stores, Meta submission |
| Logo Mark | `brand/logo-mark.jpg` | 1024x1024 | Favicon, small contexts, brand stamp |
| Full Logo | `brand/full-logo.jpg` | 1920x1080 | Website header, presentations, press |
| Social Avatar | `brand/social-avatar.jpg` | 1024x1024 | Instagram, Twitter, LinkedIn profiles |
| Brand Pattern | `brand/brand-pattern.jpg` | 2048x2048 | Background texture, slide decks, emails |

### Logo Rules

**Do:**
- Use on dark backgrounds only (Void or Graphite)
- Maintain clear space equal to the height of the bolt on all sides
- Use the full logo (bolt + wordmark) when space allows
- Use the bolt alone when space is limited (favicons, avatars, app icons)
- Include "by Huddle Duck" or "A Huddle Duck product" in footers/about pages

**Don't:**
- Place on light or white backgrounds
- Add drop shadows, outlines, or glow effects
- Rotate, stretch, or distort the bolt
- Change the yellow to any other colour
- Add text to the bolt mark itself

**Minimum Sizes:**
- Full logo: 120px wide minimum
- Bolt only: 24px minimum
- App icon: always 1024x1024 for submission, rendered at platform-native sizes

### Wordmark Spelling
- **Correct:** SuperPulse (capital S, capital P, one word)
- **Wrong:** Super Pulse, superpulse, SUPERPULSE, Superpulse, SP

### Parent Brand Attribution
- Footer: "SuperPulse by Huddle Duck"
- About page: "SuperPulse is a product of Huddle Duck Ltd"
- Press: "SuperPulse, a Huddle Duck product"

---

## Tone of Voice Cheat Sheet

### The Rule
**Looks like 2030. Speaks like your most successful friend.**

### Quick Reference

| Do | Don't |
|---|---|
| "SuperPulse boosts your posts automatically." | "Our AI-powered platform leverages machine learning..." |
| "You save about 30%." | "By utilising API-level integration..." |
| "Connect your Instagram. That's it." | "Complete the OAuth2 authentication flow..." |
| "423 people visited your profile this week." | "Your KPI dashboard indicates a 23% uplift..." |
| "Something went wrong. We're looking into it." | "An unexpected error has occurred." |

### Voice Attributes
- **Clear** — no jargon, no acronyms, could be understood by anyone
- **Confident** — declaratives, not hedges ("boosts" not "can help boost")
- **Respectful** — Ahmed is a business owner, not a "user"
- **Concise** — one sentence, not one paragraph

### Banned Words
leverage, optimise, utilize, synergy, paradigm, end-to-end, holistic, ecosystem, scalable, AI-powered (in headlines)

### Power Words
boost, automatically, your posts, while you sleep, every post, 24/7, always on, neighbourhood, local, nearby

---

## Brand Pattern

The brand pattern (`brand/brand-pattern.jpg`) is a subtle dark texture of tiny lightning bolt motifs:
- Use as a background layer behind content
- Works for slide decks, email headers, social media backgrounds
- Never increase the contrast or make it more visible — it's designed to be felt, not seen
- Tile seamlessly for larger surfaces

---

## Quick Start for Developers

Tokens + fonts are already wired (Tailwind v4, no config file). Just use the flat utilities and the UI kit.

```tsx
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/Button";

// Example component
<div className="min-h-screen bg-void text-white">
  <header className="border-b border-slate">
    <Wordmark />
  </header>
  <main className="p-6">
    <div className="text-5xl font-mono tabular-nums text-viridian">423</div>
    <div className="text-xs uppercase tracking-wider text-mist">Profile Visits</div>
    <Button variant="sandstorm" className="mt-4">Get Started</Button>
  </main>
</div>
```

---

*Last updated: July 2026 (tokens + fonts wired to the flat namespace; UI kit added) | SuperPulse by Huddle Duck Ltd*
