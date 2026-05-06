'use client';

import CounterTickUp from '@/components/scroll/CounterTickUp';

// Slide 6 — Numbers. Pure receipts. No client name-drops. The live
// counter at the bottom ticks up forever, communicating "this is
// happening every minute" without any extra copy.

const stats = [
  { value: '7p', label: 'cost per local profile visit' },
  { value: '~55K', label: 'locals reached per shop, per month' },
  { value: '£2.18', label: 'cost to reach 1,000 locals' },
  { value: '100%', label: 'of clients ran a 2nd campaign' },
];

export default function Numbers() {
  return (
    <section id="numbers">
      <div className="proposal-slide-index">06 / 08</div>
      <div className="proposal-slide-inner">
        <p className="proposal-eyebrow">The receipts</p>
        <h2 className="proposal-h2">The numbers, plain and simple.</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginTop: 8,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.value}
              className="proposal-card"
              style={{ padding: '16px 12px', textAlign: 'center' }}
            >
              <div className="proposal-stat">{s.value}</div>
              <div className="proposal-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          About 5x cheaper than the published 18p to 35p UK food benchmark.{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            80% of clients run more than 10 campaigns.
          </strong>
        </p>

        {/* Always-on live counter — visual proof "this is running right now" */}
        <div
          style={{
            marginTop: 18,
            padding: '14px 16px',
            background: 'var(--black-card)',
            border: '1px solid var(--border-bright)',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--viridian)', marginBottom: 4 }}>
            Locals reached today, across our network
          </p>
          <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', color: 'var(--viridian)' }}>
            <CounterTickUp start={847_392} incrementMin={1} incrementMax={5} intervalMs={400} />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
            Live. Resets every midnight.
          </p>
        </div>
      </div>
      <div className="proposal-scroll-hint">scroll · 6 of 8</div>
    </section>
  );
}
