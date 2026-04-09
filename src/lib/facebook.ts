const GRAPH_API = "https://graph.facebook.com/v25.0";

const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID!;
const FB_APP_SECRET = process.env.FB_APP_SECRET!;

/** Scopes required for SuperPulse — Facebook Login (NOT IG Business Login). */
export const FB_SCOPES = [
  "ads_management",
  "ads_read",
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
  "pages_show_list",
  "pages_manage_ads",
  "email",
].join(",");

/**
 * Build the Facebook OAuth dialog URL.
 */
export function buildOAuthURL(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    redirect_uri: redirectUri,
    scope: FB_SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/v25.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange an authorization code for a short-lived access token.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    client_id: FB_APP_ID,
    client_secret: FB_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${GRAPH_API}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }
  return res.json();
}

/**
 * Exchange a short-lived token for a long-lived token (~60 days).
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: FB_APP_ID,
    client_secret: FB_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${GRAPH_API}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to exchange for long-lived token: ${error}`);
  }
  return res.json();
}

/**
 * Fetch the authenticated user's basic info.
 */
export async function fetchMe(
  token: string
): Promise<{ id: string; name: string; email?: string }> {
  const res = await fetch(
    `${GRAPH_API}/me?fields=id,name,email&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch /me: ${error}`);
  }
  return res.json();
}

interface IGBusinessAccount {
  id: string;
}

interface FacebookPage {
  id: string;
  name: string;
  instagram_business_account?: IGBusinessAccount;
}

export interface PageWithIG extends FacebookPage {}

/**
 * Fetch the user's Pages and their linked Instagram Business Accounts.
 */
export async function fetchPagesWithIG(
  token: string
): Promise<PageWithIG[]> {
  const res = await fetch(
    `${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch /me/accounts: ${error}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Instagram Media
// ---------------------------------------------------------------------------

export interface IGMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

/**
 * Fetch recent media for an Instagram Business Account.
 */
export async function fetchIGMedia(
  igUserId: string,
  token: string
): Promise<IGMediaItem[]> {
  const res = await fetch(
    `${GRAPH_API}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=25&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch IG media: ${error}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Media Insights
// ---------------------------------------------------------------------------

export interface MediaInsight {
  name: string;
  period: string;
  values: { value: number }[];
  title: string;
  description: string;
  id: string;
}

/**
 * Fetch insights for a specific media object.
 * Uses media-type-appropriate metrics (impressions deprecated April 2025, use views).
 */
export async function fetchMediaInsights(
  mediaId: string,
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
  token: string
): Promise<MediaInsight[]> {
  // Different metrics per media type — requesting incompatible metrics causes hard errors
  const metrics =
    mediaType === "VIDEO"
      ? "views,reach,saved,shares,likes,comments"
      : "views,reach,saved,shares,profile_visits,likes,comments";

  const res = await fetch(
    `${GRAPH_API}/${mediaId}/insights?metric=${metrics}&access_token=${token}`
  );
  if (res.ok) {
    const data = await res.json();
    return data.data ?? [];
  }

  // If the specific set fails, try minimal universal set
  const fallbackRes = await fetch(
    `${GRAPH_API}/${mediaId}/insights?metric=reach,saved&access_token=${token}`
  );
  if (fallbackRes.ok) {
    const data = await fallbackRes.json();
    return data.data ?? [];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Ad Accounts
// ---------------------------------------------------------------------------

export interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

/**
 * Fetch ad accounts for the authenticated user.
 */
export async function fetchAdAccounts(
  token: string
): Promise<AdAccount[]> {
  const res = await fetch(
    `${GRAPH_API}/me/adaccounts?fields=id,name,account_status,currency&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch ad accounts: ${error}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

/**
 * Create a campaign in PAUSED state with OUTCOME_AWARENESS objective.
 */
export async function createCampaign(
  adAccountId: string,
  name: string,
  token: string
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API}/act_${adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
      access_token: token,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create campaign: ${error}`);
  }
  return res.json();
}

/**
 * Fetch campaigns for an ad account (ACTIVE and PAUSED only).
 */
export async function fetchCampaigns(
  adAccountId: string,
  token: string
): Promise<
  {
    id: string;
    name: string;
    status: string;
    daily_budget?: string;
    created_time: string;
  }[]
> {
  const res = await fetch(
    `${GRAPH_API}/act_${adAccountId}/campaigns?fields=id,name,status,daily_budget,created_time&effective_status=['ACTIVE','PAUSED']&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch campaigns: ${error}`);
  }
  const data = await res.json();
  return data.data ?? [];
}

/**
 * Update a campaign's status (ACTIVE, PAUSED, DELETED, etc.).
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${GRAPH_API}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      access_token: token,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to update campaign status: ${error}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Ad Set
// ---------------------------------------------------------------------------

/**
 * Create an ad set with radius-based geo targeting.
 * dailyBudget is in GBP (e.g. 5.00) — converted to cents for Meta API.
 */
export async function createAdSet(
  campaignId: string,
  adAccountId: string,
  name: string,
  dailyBudget: number,
  radiusMiles: number,
  lat: number,
  lng: number,
  pageId: string,
  token: string
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API}/act_${adAccountId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      campaign_id: campaignId,
      daily_budget: Math.round(dailyBudget * 100), // cents
      billing_event: "IMPRESSIONS",
      optimization_goal: "POST_ENGAGEMENT",
      destination_type: "ON_POST",
      promoted_object: { page_id: pageId },
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        geo_locations: {
          custom_locations: [
            {
              latitude: lat,
              longitude: lng,
              radius: radiusMiles,
              distance_unit: "mile",
            },
          ],
        },
        publisher_platforms: ["instagram"],
      },
      status: "PAUSED",
      access_token: token,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create ad set: ${error}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Ad
// ---------------------------------------------------------------------------

/**
 * Create an ad creative using an existing IG post.
 * Uses source_instagram_media_id (NOT object_story_id which is for FB posts).
 *
 * NOTE: Do NOT pass call_to_action here. When the ad set uses
 * destination_type=INSTAGRAM_PROFILE, Meta auto-assigns the
 * "Visit Instagram Profile" CTA. Sending an explicit CTA (e.g.
 * LEARN_MORE with a link) conflicts with the destination type and
 * causes the ad to be malformed / invisible in Ads Manager.
 */
export async function createAdCreative(
  adAccountId: string,
  name: string,
  igMediaId: string,
  igUserId: string,
  pageId: string,
  token: string
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API}/act_${adAccountId}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      object_id: pageId,
      instagram_user_id: igUserId,
      source_instagram_media_id: igMediaId,
      access_token: token,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create ad creative: ${error}`);
  }
  return res.json();
}

/**
 * Create an ad referencing an existing ad creative.
 */
export async function createAd(
  adSetId: string,
  adAccountId: string,
  name: string,
  creativeId: string,
  token: string
): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_API}/act_${adAccountId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
      access_token: token,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create ad: ${error}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Ad Verification (Debug)
// ---------------------------------------------------------------------------

export interface AdVerification {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  ad_review_feedback?: Record<string, unknown>;
  creative?: {
    id: string;
    source_instagram_media_id?: string;
    effective_instagram_media_id?: string;
    call_to_action_type?: string;
  };
}

/**
 * Fetch an ad's full status to verify it was created correctly.
 * Use this after createAd() to confirm the ad is valid and visible.
 */
export async function verifyAd(
  adId: string,
  token: string
): Promise<AdVerification> {
  const res = await fetch(
    `${GRAPH_API}/${adId}?fields=id,name,status,effective_status,ad_review_feedback,creative{id,source_instagram_media_id,effective_instagram_media_id,call_to_action_type}&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to verify ad: ${error}`);
  }
  return res.json();
}

/**
 * Check if an Instagram post is eligible for boosting.
 * Must be called BEFORE creating an ad creative.
 */
export async function checkBoostEligibility(
  igMediaId: string,
  token: string
): Promise<{ eligible: boolean; reason?: string }> {
  const res = await fetch(
    `${GRAPH_API}/${igMediaId}?fields=boost_eligibility_info&access_token=${token}`
  );
  if (!res.ok) {
    return { eligible: false, reason: "Failed to check eligibility" };
  }
  const data = await res.json();
  const info = data.boost_eligibility_info;
  if (!info) {
    return { eligible: true }; // No restriction info = assume eligible
  }
  // boost_eligibility_info.eligible is a boolean when present
  if (info.eligible === false) {
    return {
      eligible: false,
      reason: info.ineligible_reason ?? "Post is not eligible for boosting",
    };
  }
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Ad Insights
// ---------------------------------------------------------------------------

export interface AdInsightAction {
  action_type: string;
  value: string;
}

export interface AdInsightEntry {
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  actions?: AdInsightAction[];
  campaign_id?: string;
  campaign_name?: string;
}

/**
 * Fetch ad account insights at the campaign level for the last 7 days.
 */
export async function fetchAdInsights(
  adAccountId: string,
  token: string
): Promise<AdInsightEntry[]> {
  const res = await fetch(
    `${GRAPH_API}/act_${adAccountId}/insights?fields=impressions,reach,clicks,spend,actions&date_preset=last_7d&level=campaign&access_token=${token}`
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to fetch ad insights: ${error}`);
  }
  const data = await res.json();
  return data.data ?? [];
}
