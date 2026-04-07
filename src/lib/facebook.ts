const GRAPH_API = "https://graph.facebook.com/v25.0";

const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID!;
const FB_APP_SECRET = process.env.FB_APP_SECRET!;

/** Scopes required for SuperPulse — Facebook Login (NOT IG Business Login). */
export const FB_SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
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
