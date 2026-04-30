# Location Parser — Spec

**Authored:** 2026-04-30
**Notion subtask:** 4 (Free-form location intake)
**Files:** `src/lib/location-parser.ts`, `src/lib/places-lookup.ts`, `src/lib/anthropic.ts`, `src/app/api/locations/parse/route.ts`, `src/components/LocationIntake.tsx`

## Why

Current location intake = manual two-field form (name + address) with a radius slider. Friction-heavy. Breaks the "log in → approve budget → give locations → done" vision.

We can't auto-populate from Facebook page profiles — most client socials are dead, and Meta would ban us for scraping. Web search lookup is the safe path.

## User input

Plain text in any format, any order:

- `"Heavenly Desserts Coventry Road B10 0RX"`
- `"Phat Buns 89 stratford rd sparkhill"`
- `"Boo Burger Birmingham"` — no postcode
- `"123 fake street"` — gibberish

Multi-line textarea supports chains (one location per line).

## Stack: hybrid (regex → web → LLM fallback)

### Step 1 — UK postcode regex

```ts
export const UK_POSTCODE_RE = /\b([A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?\s*\d[ABD-HJLNP-UW-Z]{2})\b/i;
```

Free, instant, 100% accurate when present. ~95% of inputs will have a postcode.

### Step 2 — postcodes.io

`GET https://api.postcodes.io/postcodes/{postcode}`

- Free, no API key, no rate limit cliff (10 r/s).
- Returns lat/lon + admin district + ward + LSOA.
- Pins us to a 1-mile bbox for the next step.

### Step 3 — Nominatim structured query

```
GET https://nominatim.openstreetmap.org/search
  ?q={biz_name}
  &viewbox={lon-0.014,lat+0.014,lon+0.014,lat-0.014}
  &bounded=1
  &format=json
  &addressdetails=1
  &limit=5
```

User-Agent header required (already wired in `src/lib/geocode.ts`):

```
User-Agent: SuperPulse/2.0 (asad@huddleduck.co.uk)
```

Restricts the search to the postcode area. Nearly always returns the right business if it's on OSM.

### Step 4 — Claude Haiku 4.5 fallback

Fires only when regex finds no postcode OR Nominatim returns 0 candidates.

JSON-mode prompt:

```
You are a UK address extractor. From the user's text, extract:
- biz_name (string or null)
- street (string or null)
- locality (string or null) - city/town/neighborhood
- postcode (string or null) - UK format

Respond ONLY with JSON, no other text.

Input: "{user_text}"
```

Then re-run Step 2 + 3 with the structured fields.

Cost: ~$0.0001/call, latency ~500ms. Expected hit rate: <5% of inputs.

### Step 5 — Empty path

If still nothing:

```ts
return {
  candidates: [],
  message: "Couldn't find that — try adding a street name."
};
```

UI re-opens the textarea with a "let me retry" prompt.

## Why hybrid (not pure LLM, not pure rule-based)

**Not pure LLM:** UK postcodes are 100% deterministic regex. Burning a Haiku call on input that already contains `B10 0RX` is wasteful and adds a network dependency to the critical path. LLM also can't ground itself — it'll hallucinate "Coventry Road, Birmingham" when the user typed "Coventry Road" meaning Coventry, the city.

**Not pure rule-based:** "Heavenly Desserts Coventry Road B10 0RX" mixes brand + road + postcode. Regex extracts the postcode but not the brand. Without the brand we can't disambiguate the 4-5 Heavenly Desserts in Birmingham.

**Hybrid wins:** regex grounds us cheaply in 95% of cases. LLM picks up the long tail.

## API endpoint

`POST /api/locations/parse`

Request:
```json
{ "text": "Heavenly Desserts Coventry Road B10 0RX" }
```

Response:
```json
{
  "candidates": [
    {
      "display": "Heavenly Desserts • Coventry Road, Birmingham B10 0RX",
      "name": "Heavenly Desserts",
      "address": "Coventry Road, Birmingham B10 0RX",
      "latitude": 52.4664,
      "longitude": -1.8704,
      "postcode": "B10 0RX",
      "source": "nominatim"
    },
    // up to 5 alternates
  ]
}
```

For multi-line input, the request becomes `{ texts: [...] }` and the response becomes `{ results: [{ input, candidates }] }`.

## UI flow (`LocationIntake.tsx`)

1. Textarea (multi-line, placeholder: "One location per line — e.g. 'Heavenly Desserts Coventry Road B10 0RX'")
2. User submits → spinner
3. Per input line, render a card group:
   ```
   ┌─ "Heavenly Desserts Coventry Road B10 0RX" ────────────┐
   │  ◉ Heavenly Desserts • Coventry Road, B'ham B10 0RX    │
   │  ○ Heavenly Desserts • Stratford Rd, Sparkhill B11     │
   │  ○ None of these — let me retry                        │
   └─────────────────────────────────────────────────────────┘
   ```
4. First candidate preselected. User can swap or click retry.
5. "Confirm all" button bulk-saves to `/api/locations` with each confirmed `{name, address, latitude, longitude}`.
6. Default radius from `boost_settings.target_radius_miles` (or 5 if not set yet).

## Test fixtures

Unit tests in `src/lib/__tests__/location-parser.test.ts`:

| Input | Expected behavior |
|---|---|
| `"Heavenly Desserts Coventry Road B10 0RX"` | Regex hits B10 0RX → postcodes.io → Nominatim returns ≥1 candidate, first is Heavenly Desserts on Coventry Road |
| `"Phat Buns 89 stratford rd sparkhill B11 1RA"` | Regex hits B11 1RA → Nominatim returns Phat Buns on Stratford Rd |
| `"Boo Burger Birmingham"` | Regex misses → Haiku fallback fires → Nominatim retries with extracted fields → returns ≥1 Boo Burger candidate |
| `"123 fake street"` | Regex misses → Haiku extracts → Nominatim returns 0 → response includes retry message |

Mock external calls (postcodes.io, Nominatim, Anthropic) in tests so they don't hit the live network.

## Cost envelope

For 6 legacy clients × 18 locations = 108 lookups:
- Expected Haiku calls: <5
- Cost: ~£0.0005 total

Negligible. No budget concern.

## Why not Google Places

£15 per 1000 lookups + key management. Overkill until we hit thousands of signups/month. Bing Maps similar. **Defer until we measure Nominatim hit-rate in production.** If hit-rate drops below 70%, revisit.
