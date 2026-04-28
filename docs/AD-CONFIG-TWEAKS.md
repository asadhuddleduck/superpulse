# Ad Config Tweaks (pre-deploy)

Three configuration tweaks to apply to `src/lib/facebook.ts` before the next production deploy. Captured 10 Apr 2026.

**Status (28 Apr 2026):** All 3 tweaks shipped in commit `9f004a5` (Multi-tenant Phase 1, 27 Apr) — bundled with another deploy as required. Pending: live-ad QA on Asad's own IG. The persistent QA checklist lives in `docs/ARCHITECTURE.md` → "Live Ad QA Checklist". **Once that QA pass succeeds in production, delete this file** and tick the parent Notion task. Until then, keep this doc as the spec-of-record.

## Why these tweaks

The boost flow works end-to-end as of 10 Apr (verified live on `act_1059094086326037`). But the default ad config Meta auto-applies includes a bunch of placements, multi-advertiser features, and creative enhancements we don't want. We want a **clean, minimal, intentional** ad setup — Instagram-only, raw creative, no Meta-injected variants. We can always loosen the constraints later.

## Tweak 1 — Restrict placements to Instagram Reels + Stories only

**Where:** `createAdSet` in `src/lib/facebook.ts` (around line 360-388), inside the `targeting` object.

**Current state:**
```ts
targeting: {
  geo_locations: { custom_locations: [...] },
  publisher_platforms: ["instagram"],
}
```

**Target state:**
```ts
targeting: {
  geo_locations: { custom_locations: [...] },
  publisher_platforms: ["instagram"],
  instagram_positions: ["reels", "story"],
  device_platforms: ["mobile"],
}
```

**Notes:**
- User wants: Instagram Reels, Instagram Profile Reels, Instagram Stories. The API position names may differ from the Ads Manager UI labels.
- `reels` and `story` are confirmed valid v25.0 position values.
- `profile_reels` — **verified 28 Apr 2026 against Meta v25.0 targeting-spec docs (via context7): NOT in the documented enum.** Documented IG positions are `stream`, `story`, `reels`, `explore`, `explore_home`, `ig_search`. Dropped — `reels` covers profile-reel surfaces.
- Spec reference: `https://developers.facebook.com/docs/marketing-api/audiences/reference/placement-targeting`

## Tweak 2 — Disable multi-advertiser ads

**Where:** `createAd` in `src/lib/facebook.ts` (around line 450-473), at the Ad object level.

**Target state:**
```ts
body: JSON.stringify({
  name,
  adset_id: adSetId,
  creative: { creative_id: creativeId },
  status: "PAUSED",
  multi_advertiser_ads: { has_opted_out: true },
  access_token: token,
}),
```

**Notes:**
- Field name `multi_advertiser_ads.has_opted_out` is the documented opt-out for the multi-advertiser ads feature.
- Verify exact field name and shape against Meta v25.0 docs before deploy. Field may have moved between versions.
- This is a hard opt-out — user explicitly does not want the ad bundled with other advertisers' content in any Meta-managed multi-advertiser surface.

## Tweak 3 — Disable Advantage+ creative enhancements (raw creative only)

**Where:** `createAdCreative` in `src/lib/facebook.ts` (around line 414-445), inside the request body.

**Target state:** add a `degrees_of_freedom_spec` block opting out of every creative enhancement Meta would otherwise auto-apply.

```ts
body: JSON.stringify({
  name,
  object_id: pageId,           // also fix actor_id → object_id per fbts-code-auditor finding
  instagram_user_id: igUserId,
  source_instagram_media_id: igMediaId,
  call_to_action: {
    type: "VIEW_INSTAGRAM_PROFILE",
    value: { link: `https://www.instagram.com/${igUsername}/` },
  },
  degrees_of_freedom_spec: {
    creative_features_spec: {
      standard_enhancements:        { enroll_status: "OPT_OUT" },
      image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
      image_uncrop:                  { enroll_status: "OPT_OUT" },
      image_touchups:                { enroll_status: "OPT_OUT" },
      text_optimizations:            { enroll_status: "OPT_OUT" },
      image_templates:               { enroll_status: "OPT_OUT" },
      video_auto_crop:               { enroll_status: "OPT_OUT" },
      audio:                         { enroll_status: "OPT_OUT" },
      advantage_plus_creative:       { enroll_status: "OPT_OUT" },
    },
  },
  access_token: token,
}),
```

**Notes:**
- Meta ignores unknown enhancement keys silently — safe to include the full list. It accepts any subset.
- The exact enhancement keys vary slightly by v25.0 vs v26.0. Verify list before deploy by checking `https://developers.facebook.com/docs/marketing-api/advantage-plus-creative/`.
- **`actor_id` → `object_id` swap: NOT APPLIED (decision 28 Apr 2026).** The auditor recommended `object_id`, and Meta's IG Reels adcreatives example does use `object_id`. But our live config has `actor_id` empirically working since the 9 Apr verification on `act_1059094086326037`. Per "don't break what's working", `actor_id` stays as the canonical field for this codebase. If a future Ads Manager check shows the ad identity is broken, swap to `object_id` as the documented fallback. Tracked in `docs/ARCHITECTURE.md` → Live Ad QA Checklist.

## Pre-deploy verification steps

Live-ad QA (the full Ads Manager check on Asad's own IG) is now tracked in **`docs/ARCHITECTURE.md` → Live Ad QA Checklist**. That doc persists after this one is deleted, and covers all 5 verification surfaces (placements, multi-advertiser toggle, Advantage+ creative section, ad identity / `actor_id`, CTA link).

## Status

- [x] Tweak 1 implemented (commit `9f004a5`, 27 Apr 2026)
- [x] Tweak 2 implemented (commit `9f004a5`, 27 Apr 2026)
- [x] Tweak 3 implemented — `degrees_of_freedom_spec` opt-out applied. `actor_id → object_id` swap **deliberately NOT applied** (live-verified config wins). Commit `9f004a5`.
- [x] `profile_reels` validity verified (28 Apr 2026): not a valid v25.0 enum value, intentionally omitted.
- [x] Local build clean (commit `9f004a5`)
- [x] Deployed to production (multi-tenant Phase 1 deploy, 27 Apr)
- [ ] Verified live in Ads Manager on Asad's own IG (run `docs/ARCHITECTURE.md` → Live Ad QA Checklist)
- [ ] Notion task `33e84fd7bc4e81569027ed8ba0539b17` flipped to Done (only after the Ads Manager check passes)
- [ ] This file deleted (only after the Ads Manager check passes)
