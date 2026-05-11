"use client";

export const CONSENT_KEY = "sp-consent-v1";
export const CONSENT_EVENT = "sp-consent-change";

export type ConsentState = "accepted" | "rejected" | "pending";

export function readConsent(): ConsentState {
  if (typeof localStorage === "undefined") return "pending";
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "rejected" ? v : "pending";
  } catch {
    return "pending";
  }
}

export function writeConsent(state: "accepted" | "rejected"): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CONSENT_KEY, state);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  } catch {
    /* ignore */
  }
}
