type StripeErrorLike = {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
};

export type UserSafeError = {
  status: number;
  body: { error: string; code?: string };
};

export function mapStripeErrorToUserSafe(err: unknown): UserSafeError {
  const e = err as StripeErrorLike;
  const code = e?.code ?? e?.decline_code;

  if (e?.type === "StripeCardError") {
    switch (e.code) {
      case "authentication_required":
        return { status: 402, body: { error: "Your bank needs to confirm this charge. Try again to confirm.", code: "authentication_required" } };
      case "insufficient_funds":
        return { status: 402, body: { error: "Card declined: insufficient funds.", code: "insufficient_funds" } };
      case "card_declined":
        return { status: 402, body: { error: "Card declined by your bank. Try another card.", code: "card_declined" } };
      case "expired_card":
        return { status: 402, body: { error: "Card has expired.", code: "expired_card" } };
      case "incorrect_cvc":
        return { status: 402, body: { error: "CVC check failed. Try again.", code: "incorrect_cvc" } };
      case "processing_error":
        return { status: 502, body: { error: "Card processor error. Try again in a moment.", code: "processing_error" } };
      default:
        return { status: 402, body: { error: "Card declined. Try another card.", code: code ?? "card_error" } };
    }
  }

  if (e?.type === "StripeInvalidRequestError") {
    return { status: 400, body: { error: "Something went wrong with the request. Try again." } };
  }
  if (e?.type === "StripeAPIError") {
    return { status: 502, body: { error: "Payment service is unavailable. Try again in a moment." } };
  }
  if (e?.type === "StripeConnectionError") {
    return { status: 504, body: { error: "Connection to payment service timed out. Try again." } };
  }
  if (e?.type === "StripeAuthenticationError") {
    return { status: 500, body: { error: "Payment service misconfigured. Our team has been notified." } };
  }
  if (e?.type === "StripeRateLimitError") {
    return { status: 429, body: { error: "Too many attempts. Try again in a few seconds." } };
  }

  return { status: 500, body: { error: "Something went wrong. Try again." } };
}

export function logServerError(scope: string, err: unknown): void {
  const e = err as { type?: string; code?: string; message?: string };
  console.error(`[${scope}]`, e?.type || "Error", e?.code || "", e?.message || String(err));
}
