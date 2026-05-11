"use client";

export type PixelEvent =
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Purchase";

export type PixelEventParams = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  event_id?: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackPixel(
  event: PixelEvent,
  params: PixelEventParams = {},
): string {
  const eventId = params.event_id ?? randomEventId();
  if (typeof window === "undefined" || !window.fbq) return eventId;
  const { event_id: _ignored, ...rest } = params;
  void _ignored;
  window.fbq("track", event, rest, { eventID: eventId });
  return eventId;
}

function randomEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
