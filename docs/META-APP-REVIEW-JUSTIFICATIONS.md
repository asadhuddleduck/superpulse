# Meta App Review — Permission Justifications

These are the 6 permission justification texts for Superpulse's Meta App Review submission. Paste each one into the corresponding permission's "Tell us how you'll use this permission" field on the App Review form.

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
