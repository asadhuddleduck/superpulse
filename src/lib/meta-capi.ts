import { createHash } from "crypto";

export type CapiEvent =
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Purchase";

export type CapiPayload = {
  event_name: CapiEvent;
  event_id: string;
  event_time?: number;
  email?: string;
  phone?: string;
  first_name?: string;
  value?: number;
  currency?: string;
  source_url?: string;
  client_ip?: string;
  client_user_agent?: string;
  test_event_code?: string;
};

const API_VERSION = "v25.0";

function sha256(v: string): string {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export async function sendCapi(payload: CapiPayload): Promise<{ ok: boolean; status?: number; error?: string }> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return { ok: false, error: "CAPI not configured" };
  }

  const userData: Record<string, string | string[]> = {};
  if (payload.email) userData.em = sha256(payload.email);
  if (payload.phone) userData.ph = sha256(payload.phone.replace(/\D/g, ""));
  if (payload.first_name) userData.fn = sha256(payload.first_name);
  if (payload.client_ip) userData.client_ip_address = payload.client_ip;
  if (payload.client_user_agent) userData.client_user_agent = payload.client_user_agent;

  const event: Record<string, unknown> = {
    event_name: payload.event_name,
    event_time: payload.event_time ?? Math.floor(Date.now() / 1000),
    event_id: payload.event_id,
    action_source: "website",
    event_source_url: payload.source_url,
    user_data: userData,
  };

  if (payload.value !== undefined && payload.currency) {
    event.custom_data = { value: payload.value, currency: payload.currency };
  }

  const body: Record<string, unknown> = { data: [event] };
  if (payload.test_event_code) body.test_event_code = payload.test_event_code;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
