# Meta App Review — Permission Justifications

✅ **SUBMITTED 13 Apr 2026** — these 8 permission justifications were pasted into Meta's App Review form (Allowed Usage section). One screencast (`~/Downloads/superpulse-ads-management-v1-annotated.mp4`) was uploaded against each permission.

The first 6 sections below were pre-written before submission. Sections 7 (instagram_basic) and 8 (Ads Management Standard Access) were drafted on submission day to match the actual permissions in the queue. Section 7 below is the legacy `pages_read_user_content` text which was NOT submitted (we removed that permission from the queue) — it is kept here for reference only.

---

## 1. `ads_management` (Advanced Access)

Superpulse is an Instagram post boosting tool built for local businesses — any business where customers physically visit a location (restaurants, salons, gyms, cafes, barbers, mechanics, clinics, and more). Business owners connect their account once, and Superpulse helps them create and manage boost campaigns — selecting which posts to promote, setting budgets, defining a local targeting radius, choosing campaign duration, and pausing underperforming boosts. The entire value proposition depends on the ability to create, edit, and manage ad campaigns programmatically through the Marketing API.

Without ads_management, Superpulse cannot function at all. There is no manual fallback — the product exists specifically to remove the complexity of ad management from local business owners who lack the time, expertise, or desire to navigate Ads Manager themselves. Every paying customer relies on this permission for every boost that runs on their account.

We request Advanced Access because each business owner authorises Superpulse to manage campaigns on their own ad account. The app needs to operate across multiple business accounts, each belonging to a different local business, and Standard Access limits would prevent us from serving more than a handful of customers.

---

## 2. `ads_read` (Standard)

Superpulse provides every business owner with a simple reporting dashboard that shows how their boosted posts are performing — including impressions, reach, amount spent, link clicks, and Instagram profile visits. This data is pulled directly from the Marketing API's ad insights endpoints and translated into plain-language metrics that non-technical business owners can understand at a glance.

Without ads_read, business owners would have no visibility into how their money is being spent or what results their boosts are producing. They would need to leave Superpulse entirely and navigate Meta Ads Manager on their own — which defeats the purpose of the product. Transparent performance reporting is essential to building trust with customers who are delegating their advertising decisions to Superpulse.

The reporting data also feeds back into Superpulse's recommendation engine. By reading campaign-level performance metrics, the system identifies which types of posts, budgets, and targeting radii produce the best results for each individual business, and adjusts future boosting recommendations accordingly.

---

## 3. `pages_read_engagement` (Standard)

Superpulse reads basic engagement data from Facebook Pages connected to our customers' Instagram Business accounts — including post likes, comments, post type (image, video, carousel), captions, and publication timestamps. This data forms the foundation of the content scoring system that determines which posts are candidates for boosting.

The scoring algorithm uses these signals alongside Instagram insights to build a complete picture of how each post is performing. Caption content helps the app understand the context of a post (e.g., a promotion vs. a behind-the-scenes video), while timestamps allow the system to factor in recency and posting patterns when making boosting recommendations.

Without this permission, the app would lose access to fundamental content metadata needed to evaluate posts. The scoring algorithm would operate with incomplete information, leading to poorer recommendations and wasted budget for business owners who trust Superpulse to spend their money wisely.

---

## 4. `pages_show_list` (Standard)

During onboarding, a new business owner logs into Superpulse with their Facebook account and needs to select which Facebook Page (and its connected Instagram Business account) they want Superpulse to manage. This permission allows the app to retrieve the list of Pages the user administers, so we can present them in a simple selection screen.

Many business owners manage multiple Pages — for different locations, a personal brand, or legacy Pages from previous businesses. Without this permission, there is no way for the app to know which Pages exist on the user's account, and we would have no interface for them to choose the correct one. The user would be forced to manually provide Page IDs, which is an unreasonable expectation for non-technical business owners.

This is a one-time step during account setup. Once the user selects their Page, Superpulse stores the association and does not re-query the list unless the user explicitly wants to connect a different Page or add an additional location.

---

## 5. `pages_manage_ads` (Standard)

Instagram post boosts are created as ad campaigns associated with the Facebook Page linked to the Instagram Business account. This permission allows Superpulse to create and manage those boost campaigns on the Page level, working in conjunction with ads_management to execute the full campaign lifecycle — from creation through to pausing and budget adjustments.

When a business owner authorises Superpulse, they grant permission for the app to act on behalf of their Page for advertising purposes. Without pages_manage_ads, the app would be unable to associate boost campaigns with the correct Page, which means campaigns could not be created or would fail during the ad review process.

This permission is essential for the seamless operation of post boosting. Business owners expect to connect their account once and have everything work — they should never need to manually approve each campaign in Ads Manager or troubleshoot Page-level permissions themselves.

---

## 6. `pages_read_user_content` (Standard)

Superpulse reads the business owner's own Page content so they can see their Instagram posts inside the Superpulse dashboard and choose which ones to promote. When a local business owner connects their Facebook Page and linked Instagram Business account during onboarding, the app displays a grid of their recent posts alongside basic engagement data, so the owner can review their own content in one place and decide what is worth boosting. This permission is the dependency that makes that view possible — Instagram posts are surfaced through the Page that owns them, and the Graph API requires pages_read_user_content to retrieve the content attached to the user's own Page.

Without this permission, the dashboard cannot show the business owner their own posts, and the entire content-selection step of the product breaks down. The owner would have no way to review what they have published, compare recent posts, or pick a candidate to boost — they would be forced to flip back and forth between Instagram and Superpulse, defeating the purpose of a single dashboard built for non-technical local business owners who do not want to navigate Meta's native tools.

Superpulse only reads content that belongs to the authenticated user's own Page. The app does not read Page content belonging to other users, and the boost flow keeps the business owner in full control — they select which of their own posts to promote, set budget and targeting, and each campaign is created in a paused state before the owner reviews and activates it.

⚠️ **NOT SUBMITTED.** `pages_read_user_content` was not in the final submission queue — the equivalent functionality is covered by `pages_read_engagement` + `instagram_basic`, both of which were submitted.

---

## 7. `instagram_basic` (Standard) — SUBMITTED

SuperPulse uses instagram_basic to read the business owner's own Instagram Business Account profile and media, so they can see their own published Instagram posts inside the SuperPulse dashboard and choose which ones to promote as ads. When the business owner connects their Facebook Page and linked Instagram Business account during onboarding, the app fetches the IG user ID, username, and recent media (caption, timestamp, like_count, comments_count, media_type) via the /{ig-user-id}/media endpoint. The dashboard then displays a grid of the owner's recent posts so they can review their own content in one place and pick a candidate to boost as a local ad.

Without instagram_basic, the dashboard cannot show the business owner their own posts, and the entire content-selection step of the product breaks down — they would have no way to review what they have published, compare recent posts, or pick a candidate to boost. They would be forced to flip back and forth between Instagram and SuperPulse, defeating the purpose of a single dashboard built for non-technical local business owners (restaurants, salons, gyms, cafes, barbers, mechanics, clinics, and similar walk-in businesses) who do not want to navigate Meta's native tools.

SuperPulse only reads content that belongs to the authenticated user's own Instagram Business account. The app does not read media belonging to other users, and the boost flow keeps the business owner in full control — they select which of their own posts to promote, set budget and targeting, and each campaign is created in PAUSED state before it goes live.

---

## 8. `Ads Management Standard Access` (Feature) — SUBMITTED

Ads Management Standard Access is required as the foundational tier underpinning SuperPulse's Marketing API usage. SuperPulse uses the Marketing API to programmatically create and manage Instagram post boost campaigns on behalf of business owners who have explicitly granted the app access to their ad account via Facebook Login. Ads Management Standard Access enables the app to operate against the user's connected ad account by removing the development-mode restrictions that would otherwise limit calls to internal app users.

Specifically, Standard Access allows the app to call /act_{ad-account-id}/campaigns, /adsets, /adcreatives, /ads and /insights for the live ad account that the business owner has authorised — on behalf of multiple distinct local businesses (restaurants, salons, gyms, cafes, barbers, mechanics, clinics, and similar walk-in businesses) at the same time. This is the standard tier of access the Marketing API requires for any production app that helps third-party advertisers manage their campaigns, and it is requested in conjunction with the ads_management permission, which contains the actual capabilities the app exercises.

Without Ads Management Standard Access, SuperPulse would be limited to development-mode usage and could not serve real customers. Every paying customer relies on this access tier for every boost the app creates on their behalf. Each campaign is created in PAUSED state and the business owner retains full control before any ad goes live in their own Ads Manager.

---

## Submission summary (13 Apr 2026)

8 permissions were submitted. ads_management is the only one needing **Advanced Access**; the other 7 are Standard. The same screencast was uploaded against each.

| # | Permission | Tier | Notes |
|---|---|---|---|
| 1 | ads_management | **Advanced** | The big one — full Marketing API CRUD |
| 2 | ads_read | Standard | Insights API |
| 3 | pages_read_engagement | Standard | Post engagement metadata |
| 4 | pages_show_list | Standard | Page picker during onboarding |
| 5 | pages_manage_ads | Standard | Page-level ad association |
| 6 | (pages_read_user_content) | NOT SUBMITTED | covered by pages_read_engagement + instagram_basic |
| 7 | instagram_basic | Standard | IG profile + media for post grid |
| 8 | Ads Management Standard Access | Feature | Foundational tier under ads_management |
| + | email | Standard | Single agreement only — no description needed |
