# Meta App Review — Permission Justifications

These are the 7 permission justification texts for Superpulse's Meta App Review submission. Paste each one into the corresponding permission's "Tell us how you'll use this permission" field on the App Review form.

Each justification is self-contained and written for Meta's review team. They should be submitted alongside the screencast demo.

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

## 3. `instagram_manage_insights` (Advanced Access)

Superpulse's core intelligence comes from understanding which Instagram posts are worth boosting before any money is spent. To make that determination, the app analyses organic engagement signals on every post — including likes, comments, saves, video view duration, skip rate, and follower demographic breakdowns. These signals are only available through the Instagram Insights API, which requires this permission.

This is the foundation of our scoring algorithm. Rather than blindly boosting every post a business publishes, Superpulse identifies which content is already resonating organically with the local audience and recommends only those posts for boosting. This saves business owners money by avoiding spend on content that is unlikely to perform, and maximises the return on every pound spent.

We request Advanced Access because the app reads insights across multiple Instagram Business accounts belonging to different local business customers. Each business authorises Superpulse to access their account's insights data during onboarding, and the app reviews new posts to inform boosting recommendations on their behalf.

---

## 4. `pages_read_engagement` (Standard)

Superpulse reads basic engagement data from Facebook Pages connected to our customers' Instagram Business accounts — including post likes, comments, post type (image, video, carousel), captions, and publication timestamps. This data forms the foundation of the content scoring system that determines which posts are candidates for boosting.

The scoring algorithm uses these signals alongside Instagram insights to build a complete picture of how each post is performing. Caption content helps the app understand the context of a post (e.g., a promotion vs. a behind-the-scenes video), while timestamps allow the system to factor in recency and posting patterns when making boosting recommendations.

Without this permission, the app would lose access to fundamental content metadata needed to evaluate posts. The scoring algorithm would operate with incomplete information, leading to poorer recommendations and wasted budget for business owners who trust Superpulse to spend their money wisely.

---

## 5. `pages_show_list` (Standard)

During onboarding, a new business owner logs into Superpulse with their Facebook account and needs to select which Facebook Page (and its connected Instagram Business account) they want Superpulse to manage. This permission allows the app to retrieve the list of Pages the user administers, so we can present them in a simple selection screen.

Many business owners manage multiple Pages — for different locations, a personal brand, or legacy Pages from previous businesses. Without this permission, there is no way for the app to know which Pages exist on the user's account, and we would have no interface for them to choose the correct one. The user would be forced to manually provide Page IDs, which is an unreasonable expectation for non-technical business owners.

This is a one-time step during account setup. Once the user selects their Page, Superpulse stores the association and does not re-query the list unless the user explicitly wants to connect a different Page or add an additional location.

---

## 6. `pages_manage_ads` (Standard)

Instagram post boosts are created as ad campaigns associated with the Facebook Page linked to the Instagram Business account. This permission allows Superpulse to create and manage those boost campaigns on the Page level, working in conjunction with ads_management to execute the full campaign lifecycle — from creation through to pausing and budget adjustments.

When a business owner authorises Superpulse, they grant permission for the app to act on behalf of their Page for advertising purposes. Without pages_manage_ads, the app would be unable to associate boost campaigns with the correct Page, which means campaigns could not be created or would fail during the ad review process.

This permission is essential for the seamless operation of post boosting. Business owners expect to connect their account once and have everything work — they should never need to manually approve each campaign in Ads Manager or troubleshoot Page-level permissions themselves.

---

## 7. `business_management` (Advanced Access)

When a business owner connects their account to Superpulse, the app needs to identify which Business Manager and ad account to use for running boost campaigns. Many business owners have their Facebook Page and Instagram account sitting inside a Meta Business Manager — either one they created themselves, or one set up by a previous agency or marketing partner. This permission allows Superpulse to access the user's Business Manager structure to locate and connect the correct ad account.

Without business_management, the app cannot programmatically discover which ad accounts are available to the user or determine which one is associated with their selected Page. The user would need to manually find and provide their ad account ID from Business Manager settings — a step that causes significant friction and drop-off during onboarding, especially for non-technical business owners who may not even know what an ad account ID is.

We request Advanced Access because Superpulse serves multiple local businesses, each with their own Business Manager configuration. The app must be able to access the Business Manager context for every customer who authorises it, in order to correctly set up and manage campaigns on their behalf.
