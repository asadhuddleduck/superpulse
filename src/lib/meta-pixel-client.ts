"use client";

export type PixelEvent =
  | "Lead"
  | "CompleteRegistration"
  | "Schedule"
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
  const { event_id, ...rest } = params;
  void event_id;
  window.fbq("track", event, rest, { eventID: eventId });
  return eventId;
}

export function randomEventId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {
        // Fall through to manual ID
      }
    }
    if (typeof crypto.getRandomValues === "function") {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function persistEventId(scope: string, eventId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`evtid:${scope}`, eventId);
  } catch {
    /* ignore */
  }
}

export function loadEventId(scope: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`evtid:${scope}`);
  } catch {
    return null;
  }
}

export function getOrCreateEventId(scope: string): string {
  const existing = loadEventId(scope);
  if (existing) return existing;
  const fresh = randomEventId();
  persistEventId(scope, fresh);
  return fresh;
}
