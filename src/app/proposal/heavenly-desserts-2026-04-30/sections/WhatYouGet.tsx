'use client';

// Slide 7 — What You Get. Big bold price + "less than 1% of your rent"
// anchor. Compact "what's included" list.

const included = [
  'Your winning posts shown to nearby people, every week.',
  'Founder direct line, plus a monthly review.',
  'Clean local data by postcode, every month.',
];

export default function WhatYouGet() {
  return (
    <section id="get">
      <div className="proposal-slide-index">07 / 08</div>
      <div className="proposal-slide-inner">
        <p className="proposal-eyebrow">What you get</p>
        <h2 className="proposal-h2">Less than 1% of your rent.</h2>

        <div
          className="proposal-card proposal-card--accent"
          style={{ marginTop: 6, padding: 22, textAlign: 'center' }}
        >
          <div
            className="proposal-stat"
            style={{ fontSize: 'clamp(40px, 9vw, 64px)' }}
          >
            £5/day
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            per location
          </p>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Across all 62 shops, that&apos;s less than 1% of your rent.
          </p>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          {included.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: 'var(--viridian)', fontWeight: 800 }}>✓</span>
              <span>{it}</span>
            </div>
          ))}
        </div>

      </div>
      <div className="proposal-scroll-hint">scroll · 7 of 8</div>
    </section>
  );
}
