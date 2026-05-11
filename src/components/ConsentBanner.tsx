"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, writeConsent, type ConsentState } from "@/lib/consent";

export default function ConsentBanner() {
  const [state, setState] = useState<ConsentState>("pending");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(readConsent());
    function onChange(e: Event) {
      const v = (e as CustomEvent<ConsentState>).detail;
      if (v) setState(v);
    }
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (!mounted || state !== "pending") return null;

  return (
    <div className="wl-consent" role="dialog" aria-label="Cookie preferences">
      <div className="wl-consent-inner">
        <span className="wl-consent-emoji" aria-hidden>🍪</span>
        <p className="wl-consent-text">
          Quick one. We use a cookie to recognise you and show you the right stuff.
        </p>
        <button
          type="button"
          className="wl-consent-btn wl-consent-btn-primary"
          onClick={() => writeConsent("accepted")}
          autoFocus
        >
          That&rsquo;s ok
        </button>
      </div>
      <button
        type="button"
        className="wl-consent-reject"
        onClick={() => writeConsent("rejected")}
      >
        no thanks
      </button>
    </div>
  );
}
