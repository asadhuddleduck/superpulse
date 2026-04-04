# SuperPulse Business Plan V1

**AI-Powered Automated Instagram Post Boosting for Local Businesses**

Document Version: 1.0 (Working Draft)
Date: 24 March 2026
Author: Asad Shah, Founder & CEO

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem & Opportunity](#2-problem--opportunity)
3. [Product](#3-product)
4. [Market Analysis](#4-market-analysis)
5. [Competitive Landscape](#5-competitive-landscape)
6. [Pricing Strategy](#6-pricing-strategy)
7. [Technical Architecture](#7-technical-architecture)
8. [MVP Development Plan](#8-mvp-development-plan)
9. [Go-To-Market Strategy](#9-go-to-market-strategy)
10. [Messaging & Positioning](#10-messaging--positioning)
11. [Financial Model](#11-financial-model)
12. [Investment Strategy](#12-investment-strategy)
13. [Risk Assessment & Kill Signals](#13-risk-assessment--kill-signals)
14. [90-Day Execution Plan](#14-90-day-execution-plan)
15. [Week 1 Action Items](#15-week-1-action-items)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

SuperPulse is an AI-powered platform that automatically boosts Instagram posts for local businesses. The customer posts on Instagram as they normally would. SuperPulse's AI decides what to boost, when to boost it, who to target, and how much to spend. No marketing knowledge required. No dashboards to learn. No agency fees.

**The thesis is simple:** Local businesses already create Instagram content. 96.5% of their followers never see it. SuperPulse turns every post they have already made into a local ad that runs continuously.

**This is proven, not theoretical.** The founder has been doing this manually for 6 clients with zero churn, delivering 7p per profile visit, £2.18 CPM, and over 1M impressions per month for PhatBuns across 18 locations. One client (Boo Burger) gave a 10/10 NPS score. The automation simply replaces the human in the loop.

**The ask:** £200-250K SEIS round at £1-1.25M pre-money valuation to build the self-serve platform, acquire the first 300-500 customers, and reach £25-50K MRR within 12 months.

---

## 2. Problem & Opportunity

### The Problem

Local businesses — salons, restaurants, gyms, estate agents — face a brutal reality on Instagram:

- **Organic reach is dying.** The average Instagram post reaches just 3.5% of followers. A salon with 2,000 followers gets seen by 70 people.
- **Boosting works, but nobody knows how.** Meta's own boost button is a black box. Business owners pick random audiences, random budgets, and random durations. Money is wasted.
- **Agencies are too expensive.** The average local business cannot justify £500-2,000/month for a social media agency. They need results, not retainers.
- **DIY ad tools are too complex.** Platforms like Revealbot and Birch are built for media buyers, not hairdressers. The learning curve is a wall.
- **Content goes to waste.** Local businesses create 4-7 posts per week. Most of that content dies within 24 hours. It is never repurposed, never amplified, never seen by the people who would actually walk through the door.

### The Opportunity

There are 560,000 UK local businesses posting weekly on Instagram. Globally, that number is 66 million. These businesses already invest time and money in content creation. They just have no efficient way to amplify it.

SuperPulse sits at the intersection of three converging trends:

1. **Meta's API maturity.** The Marketing API v25.0 now supports full programmatic boost creation, including referencing source Instagram media IDs directly.
2. **AI cost collapse.** The scoring and decision-making that previously required a human media buyer can now be automated at pennies per decision.
3. **Local business digital adoption.** Post-COVID, even the most traditional local businesses have an Instagram presence and understand the value of online visibility.

---

## 3. Product

### What SuperPulse Does

1. **Connects to the customer's Instagram Business Account** via Meta OAuth (one-time setup, under 2 minutes).
2. **Scans all existing and new posts** every 2 hours using the Instagram Graph API.
3. **Scores each post** using an AI decision engine that evaluates engagement velocity, recency, content type, historical performance, and audience match.
4. **Automatically boosts high-scoring posts** by creating Campaign > Ad Set > Ad structures via the Meta Marketing API, referencing the original `source_instagram_media_id`.
5. **Monitors performance** every 6 hours and makes real-time adjustments: increase budget, decrease budget, pause underperformers, expand or reduce geographic targeting radius.
6. **Provides a simple dashboard** showing what was boosted, how much was spent, and what results were delivered. No jargon. No complexity.

### AI Decision Engine

The engine makes 7 distinct decision types:

| Decision | Trigger |
|---|---|
| **BOOST** | Post scores above threshold on the scoring formula |
| **DON'T BOOST** | Post scores below threshold or fails eligibility checks |
| **INCREASE BUDGET** | Post is outperforming benchmarks (CPM, engagement rate) |
| **DECREASE BUDGET** | Post is underperforming but not badly enough to pause |
| **PAUSE** | Post has degraded below minimum performance thresholds |
| **EXPAND RADIUS** | Post is performing well and has headroom for wider reach |
| **REDUCE RADIUS** | Post is overspending on distant, low-intent audiences |

### Scoring Formula

Each post is scored on a weighted composite:

| Factor | Weight | What It Measures |
|---|---|---|
| Engagement velocity | 30% | Likes, comments, saves in first 2 hours vs. account average (shares dropped — DM shares never exposed via API) |
| Recency | 20% | How fresh the post is (exponential decay) |
| Content type | 10% | Reels > Carousels > Single images (penalised until copyright confirmed) |
| Historical performance | 15% | How similar posts from this account have performed when boosted |
| Audience match | 10% | How well the post content aligns with the business's local target demographic |
| Quality signals (NEW) | 15% | skip_rate, avg_watch_time, follows, profile_activity — new Dec 2025 API signals |

### Pre-Boost Safety Checks

Before any post is boosted, SuperPulse runs three mandatory checks:

1. **Boost eligibility:** Queries `boost_eligibility_info` from the Instagram Graph API. Some posts are ineligible due to format, age, or account restrictions.
2. **Copyright music handling (try-and-fail):** 73% of restaurant Reels contain copyrighted music that cannot be used in paid promotions. Copyright CANNOT be pre-detected for app-uploaded posts (only API-uploaded). SuperPulse creates ads in PAUSED state, waits for Meta review, activates if clean, marks non-boostable if rejected.
3. **Content policy compliance:** Basic screening to avoid boosting content that could trigger Meta ad policy violations and risk the ad account.

### Proven Performance Benchmarks

These metrics come from manual execution of the same strategy for existing clients:

| Metric | Value | Context |
|---|---|---|
| Cost per profile visit | £0.07 | PhatBuns, 18 locations |
| CPM (cost per 1,000 impressions) | £2.18 | PhatBuns, 18 locations |
| Monthly impressions | 1,000,000+ | PhatBuns, single account |
| Client churn | 0% | 6 clients over operating period |
| NPS score | 10/10 | Boo Burger |
| Client count (manual) | 6 | All retained, all profitable |

---

## 4. Market Analysis

### Total Addressable Market (TAM)

- **66 million** local businesses globally with active social media presence
- Average potential spend: £150/month on social amplification
- **TAM: ~£118 billion annually**

### Serviceable Addressable Market (SAM)

- **2 million** local businesses in English-speaking markets (UK, US, Canada, Australia) with active Instagram accounts posting at least weekly
- Average price point: £150/month
- **SAM: ~£3.6 billion annually**

### Serviceable Obtainable Market (SOM) — Year 1

- **Target: 300-500 UK customers** at £149/month blended average
- **SOM: £536K-£894K ARR**
- Focused exclusively on UK market in Year 1 for regulatory simplicity, timezone alignment, and founder's existing network

### Target Verticals (Ranked by Fit)

| Rank | Vertical | Why It Fits | UK Addressable |
|---|---|---|---|
| 1 | Salons & Beauty | High Instagram usage, visual content, repeat customers | Large — fragmented market |
| 2 | Restaurants & Cafes | Already creating food content daily, foot traffic dependent | Large — high Instagram adoption |
| 3 | Gyms & Fitness Studios | Location-bound, aspirational content, membership model | Medium |
| 4 | Estate Agents | Listing content is inherently boostable, 25,805 UK agents | 25,805 businesses |

### Why These Verticals

- All are **location-dependent** (customers must physically visit)
- All **already create Instagram content** as part of their normal operations
- All have **high lifetime customer value** relative to ad spend
- All are **underserved by agencies** (too small to justify £1K+/month retainers)
- All understand Instagram but **lack the skills to run paid amplification**

---

## 5. Competitive Landscape

### Direct Competitors

| Competitor | Price | Approach | Weakness |
|---|---|---|---|
| **Boosterberg** | $25/channel/month | Rule-based auto-boosting | No AI, no local business focus, crude rules (boost if >X likes) |
| **Birch** | $49-99/month | Ad automation for media buyers | Too complex for local businesses, assumes ad knowledge |
| **Revealbot** | $49-99/month | Ad automation & rules engine | Built for performance marketers, not business owners |
| **Hootsuite** | $99-249/month + boost add-on | Social management suite with boost feature | Bloated platform, boosting is an afterthought |

### SuperPulse Differentiation

No existing product combines all three of:

1. **AI-driven decisions** (not just rule-based thresholds)
2. **Local business simplicity** (no marketing knowledge required)
3. **Automated end-to-end execution** (not just recommendations)

Boosterberg is the closest direct competitor at $25/channel, but it uses simple rules ("boost if engagement > X within Y hours"). There is no intelligence, no performance monitoring, no budget reallocation, and no geographic targeting optimization.

### The Meta Threat

**Meta Advantage+ and potential native auto-boost features represent the most significant long-term competitive risk.** Meta has the data, the distribution, and the motivation to build this natively. Estimated timeline: 12-24 months.

**Mitigation strategy:**
- Build a data moat through customer performance history and vertical-specific benchmarks
- Go multi-platform (TikTok, Google Ads) before Meta catches up
- Offer value-add layers Meta will not build: multi-location management, cross-platform analytics, content strategy recommendations
- Establish brand loyalty and switching costs through annual pricing and embedded workflows

---

## 6. Pricing Strategy

### Tier Structure

| Tier | Monthly Price | Annual Price | What's Included |
|---|---|---|---|
| **Starter** | £49/month | £408/year (£34/month) | 1 location, basic automation, standard AI scoring, email support |
| **Growth** | £99/month | £824/year (£69/month) | 1 location, full AI engine, performance monitoring, budget reallocation, priority support |
| **Pro** | £199/month | £1,658/year (£138/month) | 1 location, premium AI, dedicated onboarding, Slack/WhatsApp support, quarterly strategy call |
| **+ Managed Boost** | +£100/month | — | Human QA add-on: daily check on AI decisions, veto weak content, monthly Loom review. Pro + Managed Boost = £299/month. |

### Multi-Location Add-On

**+£29 per additional location per month** on any tier.

### Legacy Clients (Boardroom Decision — 24 March 2026)

Existing clients are grandfathered at **£297/month with unlimited locations and Managed Boost included**. They are NOT being migrated to the SuperPulse SaaS platform — they stay on the legacy manual service. If they downgrade, they lose the legacy rate permanently. Legacy deals are never discussed publicly.

This is the revenue multiplier. A business like PhatBuns with 18 locations on the Growth tier would pay:

- Base: £99/month
- Additional 17 locations: 17 x £29 = £493/month
- **Total: £592/month (£7,104/year)**

### Pricing Rationale

- **Starter at £49** undercuts Boosterberg ($25/channel x 2 channels = $50) while offering dramatically more value
- **Growth at £99** is the sweet spot — less than half the cost of the cheapest agency retainer
- **Pro at £199** captures high-intent customers who want white-glove treatment
- **Annual discount of 16.7%** (2 months free) reduces churn and improves cash flow predictability
- **14-day free trial with no credit card required** removes all friction from signup

### Revenue Targets

| Milestone | Customers | Blended ARPU | MRR |
|---|---|---|---|
| Break-even | 14-27 | £136 | £1.9-3.7K |
| Year 1 conservative | 250 | £136 | £34K |
| Year 1 target | 400 | £136 | £54K |
| £100K MRR | ~770 | £136 | £100K |

The £136 blended ARPU assumes a mix of ~40% Starter, ~45% Growth, ~15% Pro, with ~10% of customers having multiple locations.

---

## 7. Technical Architecture

### Stack

| Component | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | Founder's core expertise, SSR + API routes in one codebase |
| Database | Turso (LibSQL/SQLite edge) | Founder's existing infrastructure, low cost, global edge reads |
| Authentication | Clerk | Managed auth with OAuth flows, social login, MFA |
| Payments | Stripe | Industry standard, Billing Portal for self-serve subscription management |
| Meta Integration | Marketing API v25.0 | Full programmatic campaign management |
| Instagram Data | Instagram Graph API | Post data, engagement metrics, account insights |
| Hosting | Vercel | Founder's existing deployment infrastructure, edge functions |
| Cron/Scheduling | Vercel Cron Jobs | Post scanning (2-hourly), performance monitoring (6-hourly) |

### System Architecture

```
[Instagram Business Account]
        |
        v
[Instagram Graph API] <-- Scan every 2 hours (Vercel Cron)
        |
        v
[AI Decision Engine]
  - Score posts (engagement velocity, recency, content type, history, audience)
  - Pre-boost checks (eligibility, copyright music, content policy)
  - Decision: BOOST / DON'T BOOST / INCREASE / DECREASE / PAUSE / EXPAND / REDUCE
        |
        v
[Meta Marketing API v25.0]
  - Create Campaign > Ad Set > Ad
  - Reference source_instagram_media_id
  - Set geographic targeting (radius from business location)
  - Set budget (daily, based on AI allocation)
        |
        v
[Performance Monitor] <-- Check every 6 hours (Vercel Cron)
  - Compare against benchmarks (CPM, reach, engagement, profile visits)
  - Feed back into AI Decision Engine for adjustments
        |
        v
[Customer Dashboard]
  - What was boosted and why
  - Spend vs. results
  - Simple, jargon-free metrics
```

### Database Schema (Core Tables)

- **accounts** — Customer accounts, Clerk user IDs, subscription tier
- **instagram_connections** — Meta OAuth tokens, Instagram Business Account IDs, ad account IDs
- **locations** — Business locations with coordinates, radius settings
- **posts** — Synced Instagram posts with engagement data, scores, boost eligibility
- **decisions** — AI decision log (what was decided, why, confidence score)
- **boosts** — Active boost campaigns with Meta campaign/adset/ad IDs
- **performance** — Time-series performance data (impressions, reach, CPM, profile visits, spend)
- **subscriptions** — Stripe subscription data, tier, location count

### Scalability

The cron-based decision engine works reliably up to approximately **500 tenants** before hitting Vercel cron execution time limits. Beyond 500 customers:

- Migrate to queue-based architecture (e.g., Inngest, BullMQ, or AWS SQS)
- Shard scanning by account groups
- Move performance monitoring to dedicated workers

This is a good problem to have and does not need to be solved at MVP stage.

### Cost of Goods Sold (Per Customer)

| Item | Monthly Cost |
|---|---|
| Turso database | ~£0.03 |
| Vercel compute (crons, API routes) | ~£0.50 |
| Clerk authentication | ~£0.20 |
| Meta API calls | £0.00 (free) |
| AI scoring compute | ~£1.00 |
| **Total COGS per customer** | **~£1.73** |

**Gross margin: 96%** at the Growth tier (£99/month revenue, £1.73 COGS).

---

## 8. MVP Development Plan

### Timeline: 10-12 Weeks

The MVP is scoped for a solo developer (the founder) working full-time.

### Week 0: Pre-Build (Critical Path)

**This week happens before any code is written.**

- [ ] **Submit Meta App Review application** — This is the existential gate. Without Marketing API approval, the product cannot function. Submit immediately and build in parallel.
- [ ] **Validate with 10 customer calls** — 5-question script covering: (1) How do you currently promote Instagram posts? (2) How much do you spend on social media ads monthly? (3) Would you pay £99/month for automatic post boosting? (4) What result would make it worth it? (5) How many locations do you have?
- [ ] **Set up development environment** — Next.js 16, Turso, Clerk, Stripe test mode

### Weeks 1-4: Foundation

| Week | Deliverables |
|---|---|
| Week 1 | Clerk authentication, user onboarding flow, Turso database schema, account creation |
| Week 2 | Stripe integration (subscription tiers, Billing Portal, webhooks), pricing page |
| Week 3 | Meta OAuth flow (Instagram Business Account connection), token storage & refresh |
| Week 4 | Instagram post sync (pull all posts, store engagement data, schedule 2-hourly cron) |

### Weeks 5-8: Core Engine

| Week | Deliverables |
|---|---|
| Week 5 | AI scoring engine (implement weighted formula, score all synced posts) |
| Week 6 | Boost execution (Campaign > Ad Set > Ad creation via Marketing API, geographic targeting) |
| Week 7 | Performance monitoring (6-hourly cron, benchmark comparison, adjustment decisions) |
| Week 8 | Customer dashboard (what was boosted, spend, results, simple metrics) |

### Weeks 9-10: Polish & Beta Prep

| Week | Deliverables |
|---|---|
| Week 9 | Pre-boost safety checks (eligibility, copyright music, content policy), error handling |
| Week 10 | Onboarding flow refinement, email notifications (Resend), beta deployment to production |

### Weeks 11-12: Buffer & Soft Launch

| Week | Deliverables |
|---|---|
| Week 11 | Beta testing with first 10-20 Founders wave customers, bug fixes |
| Week 12 | Iterate based on feedback, prepare for Wave 2 launch |

### What Is NOT in MVP

- Multi-platform support (TikTok, Google Ads)
- Advanced analytics or reporting
- Content strategy recommendations
- Team/agency features
- White-label capabilities
- Mobile app

These are all post-product-market-fit features.

---

## 9. Go-To-Market Strategy

### Phase 1: Waitlist (Months 1-3)

**Target: 2,500 signups** (not 10K — a smaller, hotter list converts better)

#### Waitlist Landing Page
- Built on the existing Huddle Duck stack (Next.js + Turso + Resend)
- Simple value proposition, email capture, referral program
- Social proof from existing manual client results (with permission)

#### Referral Engine
- **Viral Loops** ($35/month) implementing the Harry's milestone referral model
- Referral rewards at milestones: 5 referrals = priority access, 10 = 1 month free, 25 = lifetime Starter tier
- Unique referral links, leaderboard, automated reward fulfilment

#### Waitlist Growth Channels
- LinkedIn posts 3x/week (founder-led, building in public)
- YouTube 1x/week (behind-the-scenes development, marketing insights)
- Threads daily (via Thread Storm MCP)
- Anchor article: **"Meta told my client 23 sales. The real number was 9."** — designed to go viral in the local business marketing community
- Direct outreach to existing Huddle Duck network and contacts

#### Budget: £8-12K over 4 months
- Paid social ads promoting waitlist: £4-6K
- Event attendance and travel: £2-3K
- Tools (Viral Loops, email, design): £1-2K
- Content production: £1K

### Phase 2: Wave Launch (Month 3-4)

Launch in controlled waves to manage support load and iterate:

| Wave | Size | Criteria | Timing |
|---|---|---|---|
| **Founders** | 50 | Earliest signups, referral champions, existing Huddle Duck clients | Month 3 |
| **Early Adopters** | 200 | Active referrers, engaged waitlist members | Month 3.5 |
| **General Access** | 500 | Remaining waitlist | Month 4 |
| **Public** | Open | Anyone | Month 4.5+ |

Each wave gets 1-2 weeks before the next opens. This creates urgency, generates testimonials, and prevents support overwhelm.

### Phase 3: Speaking Circuit (Months 2-6)

The founder's origin story (agency owner who discovered the boosting pattern) is a natural stage talk. 25 UK events identified:

**Priority Events:**
- brightonSEO (2,000+ marketers, strong SMB track)
- Atomicon (Andrew & Pete's community, perfect audience)
- Birmingham Business Expo (local, low barrier to entry)
- The Business Show (ExCeL London, massive footfall)
- Social Media Marketing World (virtual/US, if accepted)

**Talk angle:** "I ran an ad agency and discovered that 73% of my clients' Reels couldn't even be boosted. Here's what I built instead."

### Phase 4: Content-Led Growth (Ongoing)

**5 Content Pillars:**

1. **Content Waste** — "You spent 2 hours on that Reel and 70 people saw it"
2. **Numbers Don't Lie** — Real performance data, benchmarks, comparisons
3. **Marketing Is Broken** — Meta attribution lies, agency model failures
4. **Building in Public** — Development updates, customer wins, honest failures
5. **Customer Wins** — Case studies, before/after metrics, testimonials

**10-Email Waitlist Nurture Sequence:**
Designed to educate, build trust, and convert waitlist members to paying customers over 3 weeks. Each email maps to a content pillar and includes a specific proof point from existing client data.

### What We Are NOT Doing

- **AppSumo** — Lifetime deals kill recurring revenue. The short-term cash injection is not worth the long-term MRR destruction.
- **Cold outreach at scale** — Brand damage risk. All outreach is warm (referral, content, speaking).
- **Paid agency partnerships** — Too early. Agencies are a distribution channel for Year 2+.
- **International expansion** — UK only in Year 1. Regulatory, timezone, and support simplicity.

---

## 10. Messaging & Positioning

### One-Liner

> **"SuperPulse turns every post you've already made into a local ad that runs forever."**

### Elevator Pitch (30 Seconds)

"Local businesses spend hours creating Instagram content that only 3.5% of their followers ever see. SuperPulse connects to their Instagram account and automatically turns their best posts into local ads — targeting people nearby who are most likely to walk through the door. No marketing knowledge needed. No agency fees. Just post on Instagram like you normally do, and SuperPulse handles the rest. We've already proven it works: 7p per profile visit, zero churn across 6 clients."

### Origin Story (For Stage)

**4-Act Narrative:**

1. **Discovery:** "I was running a marketing agency and noticed something strange. My clients' organic Instagram posts were getting 50 likes, but when I boosted the same posts with £5, they'd get 5,000 views from local people. The content was already good — it just needed amplification."

2. **Experiment:** "So I started boosting every post for one client — a burger restaurant with 18 locations. Within a month, we hit 1 million impressions at £2.18 CPM. Profile visits cost 7p each. The owner couldn't believe it."

3. **Pattern:** "Then I discovered the problem. 73% of their Reels used copyrighted music — meaning they couldn't even be boosted. And Meta's own attribution was lying to us. They said 23 sales. The real number was 9. I realised nobody was solving this properly."

4. **Vision:** "That's when I decided to build SuperPulse. Take everything I learned doing this manually for 6 clients and automate it. Every local business deserves a 7p profile visit. They just shouldn't need an agency to get it."

### Positioning Statement

**For** local businesses with active Instagram accounts **who** want more local customers from their existing content, **SuperPulse is** an AI-powered post boosting platform **that** automatically turns Instagram posts into high-performing local ads. **Unlike** agencies, DIY ad tools, or Meta's basic boost button, **SuperPulse** requires zero marketing knowledge and optimises continuously based on real performance data.

---

## 11. Financial Model

### Revenue Projections (12 Months)

Three scenarios based on customer acquisition pace:

| Scenario | Month 12 MRR | Month 12 Customers | Blended ARPU | ARR |
|---|---|---|---|---|
| **Conservative (Investor Deck)** | £15-20K | 110-150 | £136 | £180-240K |
| **Realistic (Internal Target)** | £25-50K | 185-370 | £136 | £300-600K |
| **Optimistic (With Franchise Deals)** | £100K | ~770 | £130 | £1.2M |

The optimistic scenario assumes landing 2-3 multi-location franchise accounts (like PhatBuns) that contribute disproportionately to MRR through the +£29/location add-on.

### Monthly Growth Model (Realistic Scenario)

| Month | New Customers | Churned (5%) | Total Customers | MRR |
|---|---|---|---|---|
| 1 | 0 | 0 | 0 | £0 |
| 2 | 0 | 0 | 0 | £0 |
| 3 | 50 | 0 | 50 | £6,800 |
| 4 | 40 | 3 | 87 | £11,832 |
| 5 | 35 | 4 | 118 | £16,048 |
| 6 | 30 | 6 | 142 | £19,312 |
| 7 | 25 | 7 | 160 | £21,760 |
| 8 | 30 | 8 | 182 | £24,752 |
| 9 | 35 | 9 | 208 | £28,288 |
| 10 | 40 | 10 | 238 | £32,368 |
| 11 | 45 | 12 | 271 | £36,856 |
| 12 | 50 | 14 | 307 | £41,752 |

*Assumes 5% monthly churn and £136 blended ARPU.*

### Cost Structure (Monthly, at Scale)

| Category | Month 1-3 | Month 4-6 | Month 7-12 |
|---|---|---|---|
| COGS (£1.73/customer) | £0 | £245 | £530 |
| Founder salary | £0 | £0 | £0 (reinvesting) |
| VA (support + admin) | £600 | £600 | £600 |
| Marketing & ads | £2,000 | £2,500 | £3,000 |
| Tools (Clerk, Stripe, Viral Loops, etc.) | £200 | £350 | £500 |
| Events & travel | £500 | £500 | £300 |
| **Total monthly burn** | **£3,300** | **£4,195** | **£4,930** |

### Break-Even Analysis

| Scenario | Customers Needed | Monthly Ad Spend Context |
|---|---|---|
| Minimal (no ad spend) | 14 customers | Just COGS + tools |
| With £1K/month ad spend | 21 customers | Light growth marketing |
| With £2K/month ad spend | 27 customers | Moderate growth marketing |

Break-even is achievable within the first wave of 50 Founders customers.

### Unit Economics

| Metric | Value |
|---|---|
| Blended ARPU | £136/month |
| COGS per customer | £1.73/month |
| Gross margin | 96% |
| Gross profit per customer | £134.27/month |
| Target CAC (blended) | £50-80 |
| LTV at 5% monthly churn | £2,720 (20-month average lifetime) |
| LTV:CAC ratio | 34:1 to 54:1 |

### Key Assumptions

- **Monthly churn: 5%** — Conservative for planning. Actual manual client churn is 0%, but self-serve will be higher.
- **Blended ARPU: £136** — Based on 40% Starter / 45% Growth / 15% Pro with 10% multi-location customers.
- **No founder salary** — Founder reinvests all revenue in Year 1. Living costs covered by existing Huddle Duck retainer income from 8 legacy agency clients.

---

## 12. Investment Strategy

### The Raise

| Parameter | Value |
|---|---|
| Amount | £200-250K |
| Structure | SEIS (Seed Enterprise Investment Scheme) |
| Valuation | £1-1.25M pre-money |
| Tranching | £150K on close, £100K at milestones |
| Milestone triggers | 30-50 self-serve paying customers + Meta App Review approval |

### Why SEIS

SEIS offers UK investors:
- **50% income tax relief** on investments up to £200K/year
- **Capital gains tax exemption** on profits from SEIS shares
- **Loss relief** if the company fails — investors can offset losses against income tax

This makes SuperPulse significantly more attractive to angel investors. A £10K investment effectively costs the investor £5K after tax relief, with unlimited upside.

### Cap Table (Post-Round)

| Shareholder | Ownership |
|---|---|
| Asad Shah (Founder) | ~65% |
| Dr Fuzail (Existing) | ~17% |
| New SEIS Investors | ~15% |
| ESOP (Employee Option Pool) | ~3% |

Note: Dr Fuzail's existing 20% stake is diluted pro-rata. No special protections or renegotiation — leave as-is.

### Target Investors

| Investor | Type | Why |
|---|---|---|
| **SFC Capital** | SEIS Fund | UK's most active SEIS investor. **Deadline: 10 April 2026 — URGENT** |
| **Galvanise Capital** | Angel Network | MarTech focus, relevant domain expertise |
| **Minerva Birmingham** | Angel Network | Local angels, founder is Birmingham-based |
| **Individual angels** | Direct | Approached through speaking circuit and LinkedIn |

### Use of Funds

| Category | Amount | % of Raise |
|---|---|---|
| Product development (tools, infrastructure) | £30-40K | 15-16% |
| Marketing & customer acquisition | £60-80K | 30-32% |
| VA & support (12 months) | £7.2K | 3% |
| Events, travel, speaking | £10-15K | 5-6% |
| Working capital & runway buffer | £80-100K | 40-44% |

### Pre-Raise Preparation

1. **SEIS Advance Assurance** — Apply to HMRC immediately. This confirms SEIS eligibility before approaching investors and removes a major friction point.
2. **Pitch deck** — 12 slides maximum. Lead with the manual proof (zero churn, 7p/profile visit), not the vision.
3. **Financial model** — Spreadsheet version of the projections above, with adjustable assumptions.
4. **Demo** — Even a partially functional MVP is 10x more convincing than slides.

---

## 13. Risk Assessment & Kill Signals

### Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Meta App Review rejection** | EXISTENTIAL | Medium | Submit Week 0. Build in parallel. If rejected, iterate on submission. Fallback: use Instagram Promote API (limited but functional for V1). |
| **Meta builds native auto-boost** | HIGH | Medium (12-24 months) | Go multi-platform before they ship. Build data moat (vertical benchmarks, performance history). Establish brand loyalty via annual pricing. |
| **Higher churn than expected** | MEDIUM | Medium | Run 50-customer beta before scaling. Weekly value emails showing ROI. Push annual pricing aggressively (16.7% discount). |
| **Copyright music blocks most Reels** | MEDIUM | High (73% of restaurant Reels) | Try-and-fail pattern: create ad PAUSED, wait for review, activate if clean, reject if copyright flagged. Learn per-account failure rates to deprioritise Reels over time. Educate customers on music-free content creation. |
| **Cascading ad account bans** | MEDIUM | Low | Account isolation (one ad account per customer). Pre-boost content screening. Rate limiting on boost creation. |
| **Solo founder + baby (August 2026)** | MEDIUM | Certain | Hire VA from Month 1 (£600/month). Launch and reach product-market fit before August. Build for self-serve from day one. Reduce scope ruthlessly. |
| **Support burden overwhelms founder** | MEDIUM | Medium | Self-serve documentation. In-app explanations for every metric. VA handles Tier 1 support. Wave launch controls inflow. |
| **Low waitlist conversion** | LOW-MEDIUM | Medium | 14-day free trial removes risk. Waitlist nurture sequence builds trust. Direct customer conversations identify objections early. |

### Kill Signals

These are the hard stop criteria. If any of these are met, the project is either killed or fundamentally pivoted:

1. **Meta App Review rejected twice with different objections** — This means Meta does not want third parties doing this. Kill the project. Do not waste more time.

2. **Month 6 MRR below £8K** — Six months is enough time to validate demand. Below £8K MRR (roughly 60 customers) indicates insufficient product-market fit. Kill or pivot.

3. **Monthly churn above 10% for 3 consecutive months** — Sustained high churn means the product is not delivering enough value to retain customers. Pivot the value proposition or kill.

4. **Support tickets exceed 2 per customer per month** — This indicates the product is too complex or too buggy for self-serve local business customers. Pause growth and fix onboarding/UX.

5. **Meta announces native auto-boost feature** — Triggers a 6-month countdown to pivot to multi-platform. If SuperPulse has not expanded beyond Instagram boosting by then, wind down.

---

## 14. 90-Day Execution Plan

### Month 1: Validate + Waitlist + Begin Build

**Objective:** Confirm demand, start Meta App Review, begin MVP development, launch waitlist.

| Week | Actions |
|---|---|
| Week 1 | Submit Meta App Review. Apply for SEIS Advance Assurance. Apply to SFC Capital. Register with Minerva Birmingham. |
| Week 2 | Build and launch waitlist landing page. Set up Viral Loops referral engine. Call 10 potential customers with validation script. |
| Week 3 | Begin MVP development (Clerk auth, Turso schema, account creation). Write and publish anchor article. |
| Week 4 | Stripe integration (tiers, billing portal, webhooks). LinkedIn content begins (3x/week). First Threads posts. |

**Key metrics:** 10 validation calls completed. Meta App Review submitted. Waitlist live. 100+ waitlist signups.

### Month 2: MVP Development + Waitlist Growth

**Objective:** Build core product. Grow waitlist to 1,000. Begin speaking applications.

| Week | Actions |
|---|---|
| Week 5 | Meta OAuth flow. Instagram post sync. 2-hourly scan cron. |
| Week 6 | AI scoring engine. Post scoring algorithm. Decision logic. |
| Week 7 | Boost execution via Marketing API. Pre-boost safety checks. |
| Week 8 | Performance monitoring cron. Budget adjustment logic. Customer dashboard. |

**Key metrics:** Core engine functional in staging. 500-1,000 waitlist signups. 2-3 speaking slots confirmed. Meta App Review response received (or follow-up sent).

### Month 3: Beta Launch (Wave 1: Founders)

**Objective:** First 50 paying customers. Validate unit economics. Collect testimonials.

| Week | Actions |
|---|---|
| Week 9 | Onboarding flow polish. Email notifications. Error handling. Beta deployment. |
| Week 10 | Invite first 50 Founders wave. Onboard personally (video call each one). |
| Week 11 | Monitor performance. Fix bugs. Collect feedback. Write case studies. |
| Week 12 | Prepare Wave 2 (Early Adopters). Apply learnings. Begin investor conversations with real data. |

**Key metrics:** 50 paying customers. £6,800+ MRR. Zero critical bugs. 3+ testimonials collected. First investor meetings scheduled.

### Months 4-5: Scale (Pre-Baby)

**Objective:** Reach 100-200 customers. Secure speaking gigs. Close SEIS round.

- Open Wave 2 (200 Early Adopters) and Wave 3 (500 General Access)
- Attend 2-3 speaking events with polished origin story talk
- Close SEIS round with real customer data and MRR trajectory
- Hire VA for Tier 1 support and admin
- YouTube content production begins (1x/week)

**Key metrics:** 150-200 customers. £20-27K MRR. SEIS round closed. 2+ speaking gigs completed.

### Month 6+: Post-Baby Autopilot

**Objective:** Product runs independently. Growth continues with reduced founder involvement.

- Product operates on cron-based autopilot (2-hour scan, 6-hour monitor)
- VA handles Tier 1 support, onboarding emails, waitlist management
- Content continues via scheduled posts (batched in advance)
- Founder available for strategic decisions and Tier 2 support
- Growth comes from referral engine, content flywheel, and word of mouth

**Key metrics:** Sustained 5-10% month-over-month growth with reduced founder time. Churn below 5%. Support tickets below 2/customer/month.

---

## 15. Week 1 Action Items

These are the 8 actions that must be completed in the first 7 days. They are ordered by priority (existential gates first, then revenue enablers, then growth infrastructure).

| # | Action | Why It Matters | Deadline |
|---|---|---|---|
| 1 | **Submit Meta App Review application** | Existential gate. Without Marketing API approval, the product cannot exist. Long review times (2-6 weeks) mean every day of delay pushes the entire timeline. | Day 1 |
| 2 | **Apply for SEIS Advance Assurance with HMRC** | Confirms SEIS eligibility before investor conversations. Removes a major objection. Takes 4-6 weeks to process. | Day 2 |
| 3 | **Apply to SFC Capital SEIS Fund** | Deadline is 10 April 2026. This is 17 days away. Application must be submitted this week. | Day 2 |
| 4 | **Register with Minerva Birmingham angel network** | Local angels, lower barrier than London VCs, relevant for pre-seed. | Day 3 |
| 5 | **Build waitlist landing page** | Next.js + Turso + Resend. Simple page with value prop, email capture, referral link. Needed before any public marketing begins. | Day 3-5 |
| 6 | **Set up Viral Loops referral engine** | $35/month. Harry's milestone model. Integrate with waitlist page. Must be live before first signups to capture referral data. | Day 5 |
| 7 | **Call 10 potential customers** | 5-question validation script. Target: 3 salons, 3 restaurants, 2 gyms, 2 estate agents. Record answers. Update assumptions based on responses. | Day 5-7 |
| 8 | **Write anchor article** | "Meta told my client 23 sales. The real number was 9." Publish on LinkedIn, cross-post to blog. This is the top-of-funnel magnet for the waitlist. | Day 7 |

---

## 16. Appendix

### A. Validation Script (5 Questions)

For use in Week 1 customer calls:

1. "How do you currently promote your Instagram posts? Do you ever use the boost button or run ads?"
2. "Roughly how much do you spend on social media advertising each month?"
3. "If a tool could automatically boost your best Instagram posts to people near your business for £99/month, would you try it?"
4. "What specific result would make £99/month feel like a bargain? More followers? More messages? More foot traffic?"
5. "How many locations does your business have?"

### B. Meta App Review Requirements

The Marketing API review requires:

- Business verification (business documents, domain verification)
- App purpose description (how the API will be used)
- Screencast demonstrating the integration (can be a prototype/mockup)
- Privacy policy and terms of service
- Data handling explanation

Key permissions needed:
- `ads_management` — Create and manage ad campaigns
- `ads_read` — Read ad performance data
- `instagram_manage_insights` — Read Instagram account data + post engagement metrics (replaces deprecated `instagram_basic` since Jan 2025)
- `pages_manage_ads` — Manage ads through connected Facebook Pages
- `pages_read_engagement` — Read Page engagement data

### C. Key Metrics to Track

**Business Metrics:**
- MRR (Monthly Recurring Revenue)
- Customer count (total, by tier)
- Churn rate (monthly, by cohort)
- ARPU (Average Revenue Per User)
- CAC (Customer Acquisition Cost, by channel)
- LTV (Lifetime Value)
- LTV:CAC ratio

**Product Metrics:**
- Posts scanned per day
- Posts boosted per day (and % of scanned)
- Average boost budget per customer
- Average CPM delivered
- Average cost per profile visit delivered
- Decision accuracy (boost decisions that outperform random selection)
- Time to first boost (from signup)

**Growth Metrics:**
- Waitlist signups (total, daily)
- Waitlist conversion rate (signup to paid)
- Referral rate (% of customers who refer)
- Viral coefficient (referrals per customer)
- Content engagement (LinkedIn, YouTube, Threads)

### D. Competitive Pricing Comparison

| Platform | Monthly Price | What You Get | AI? | Local Focus? |
|---|---|---|---|---|
| SuperPulse Starter | £49 | Auto-boost, basic AI | Yes | Yes |
| SuperPulse Growth | £99 | Full AI, monitoring, reallocation | Yes | Yes |
| Boosterberg | ~£20 ($25) | Rule-based boost | No | No |
| Birch | ~£40-80 ($49-99) | Ad automation | Partial | No |
| Revealbot | ~£40-80 ($49-99) | Ad rules engine | No | No |
| Hootsuite + Boost | ~£80-200 ($99-249) | Social suite + boost add-on | No | No |
| Local agency | £500-2,000 | Managed service | Varies | Sometimes |

### E. SEIS Investor One-Pager (Summary)

**SuperPulse** — AI-powered Instagram post boosting for local businesses

- **Problem:** 96.5% of Instagram followers never see a business's posts. Boosting works but requires expertise local businesses don't have.
- **Solution:** Connect Instagram, AI handles everything. Zero marketing knowledge needed.
- **Traction:** Proven manually — 7p/profile visit, £2.18 CPM, 1M+ impressions/month, 0% churn, 10/10 NPS.
- **Market:** 560K UK local businesses posting weekly on Instagram. £3.6B SAM.
- **Model:** SaaS, £49-199/month + £29/location. 96% gross margin. £136 blended ARPU.
- **Ask:** £200-250K SEIS at £1-1.25M pre-money.
- **Use of funds:** Product build (15%), marketing (30%), runway (55%).
- **Target:** 300-500 customers, £25-50K MRR within 12 months.
- **Team:** Asad Shah — built and ran the manual version for 6 clients with zero churn. Technical founder (Next.js, Meta API, AI). Building Huddle Duck AI tool company.

---

*This is a V1 working document. It will be refined as customer validation data, Meta App Review outcomes, and investor feedback are incorporated.*

*Last updated: 24 March 2026*
