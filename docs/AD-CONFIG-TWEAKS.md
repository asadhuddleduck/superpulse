# Ad Config Tweaks (pre-deploy)

Three configuration tweaks to apply to `src/lib/facebook.ts` before the next production deploy. Captured 10 Apr 2026.

**Once these are applied, deployed, and verified working in production: delete this file.** It's a temporary note, not a long-term doc.

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
- `profile_reels` — needs verification before adding. If valid in v25.0, add it. If not, drop it (Reels position covers most profile reel surfaces).
- Verify against Meta docs at `https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-specs/` before deploy.

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
- Note: this also includes the **`actor_id` → `object_id`** fix from the fbts-code-auditor's audit. The auditor was confident this is the canonical field name for `source_instagram_media_id`-based creatives. Worth applying at the same time, as it's a one-line fix in the same function.

## Pre-deploy verification steps

1. Run `npm run build` and confirm clean build
2. Test boost on a non-Reel post via the live dashboard
3. Open Ads Manager → check the new campaign:
   - Placements should show ONLY Instagram Reels + Stories (and Profile Reels if `profile_reels` was valid)
   - Multi-advertiser ads toggle should be OFF
   - Advantage+ creative section should show all enhancements OFF
4. If anything is wrong, fix before merging the deploy
5. Once verified in production, **delete this file** (`docs/AD-CONFIG-TWEAKS.md`)

## Status

- [ ] Tweak 1 implemented
- [ ] Tweak 2 implemented
- [ ] Tweak 3 implemented (incl. actor_id → object_id fix)
- [ ] Local build clean
- [ ] Deployed to production
- [ ] Verified in Ads Manager
- [ ] This file deleted
