'use client';

import PhotoConveyor from '@/components/scroll/PhotoConveyor';

// Slide 2 — Snapshot (redacted). Photo conveyor wrapped in a heavy blur
// + desaturate so individual dishes/storefronts can't be reverse-image
// searched. Stats and copy unchanged ("62 shops" alone is generic).

const stats = [
  { value: '3.4M', label: 'locals reached', sub: 'in your first month' },
  { value: '40M+', label: 'locals reached', sub: 'across the year' },
  { value: '10K to 55K', label: 'new local followers', sub: 'within 3 months' },
  { value: 'Minutes', label: 'to switch on', sub: 'no setup runway' },
];

export default function Snapshot() {
  return (
    <section id="snapshot">
      <div className="proposal-slide-index">02 / 08</div>
      <div className="proposal-slide-inner">
        <p className="proposal-eyebrow">A quick snapshot</p>
        <h2 className="proposal-h2">What this could look like for your 62 shops.</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginTop: 6,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.value}
              className="proposal-card"
              style={{ padding: '16px 14px' }}
            >
              <div className="proposal-stat" style={{ fontSize: 'clamp(26px, 5.5vw, 40px)' }}>
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginTop: 6,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Brand vibe — left-scrolling photo conveyor, heavily blurred for redaction */}
        <div
          style={{
            marginTop: 22,
            marginLeft: -22,
            marginRight: -22,
            filter: 'blur(14px) saturate(0.5) brightness(0.85)',
          }}
        >
          <PhotoConveyor tileHeight={170} />
        </div>
      </div>
      <div className="proposal-scroll-hint">scroll · 2 of 8</div>
    </section>
  );
}
