'use client';

import PulsingRadius from '@/components/scroll/PulsingRadius';

// Slide 4 — Fix (redacted). PulsingRadius caption swapped to "each [REDACTED]".

export default function Fix() {
  return (
    <section id="fix">
      <div className="proposal-slide-index">04 / 08</div>
      <div className="proposal-slide-inner" style={{ textAlign: 'center' }}>
        <p className="proposal-eyebrow">The fix</p>
        <h2 className="proposal-h2">
          We show your post to nearby people, again and again, every week.
        </h2>

        <div style={{ marginTop: 12 }}>
          <PulsingRadius size={240} label="each [REDACTED] location" />
        </div>

        <p className="proposal-body" style={{ marginTop: 14, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Same post. Different week. Same nearby people. Until they&apos;ve
          seen it enough times to walk in. We never spam them. We just
          stop the post from dying.
        </p>
      </div>
      <div className="proposal-scroll-hint">scroll · 4 of 8</div>
    </section>
  );
}
