'use client';

import PathOfLight from '@/components/scroll/PathOfLight';

// Slide 5 — How It Works. 3 simple steps. The PathOfLight loop shows
// post → engine → local in motion.

const steps = [
  {
    n: '1',
    title: 'You post.',
    body: 'Your team posts on Instagram exactly like they do today. Nothing changes.',
  },
  {
    n: '2',
    title: 'Superpulse picks the winners.',
    body: "We watch which posts land. The good ones get pushed. The duds get left alone.",
  },
  {
    n: '3',
    title: 'Locals see it. Then see it again.',
    body: 'Each winner runs near every shop, to nearby people, every week. While you sleep.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how">
      <div className="proposal-slide-index">05 / 08</div>
      <div className="proposal-slide-inner">
        <p className="proposal-eyebrow">How it works</p>
        <h2 className="proposal-h2">Three quiet steps. Zero hires.</h2>

        <div style={{ marginTop: 6, marginBottom: 14 }}>
          <PathOfLight />
        </div>

        <ol style={{ display: 'grid', gap: 8, listStyle: 'none', padding: 0 }}>
          {steps.map((s) => (
            <li key={s.n} className="proposal-card" style={{ padding: '11px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 2 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 22,
                    fontWeight: 900,
                    color: 'var(--viridian)',
                    lineHeight: 1,
                  }}
                >
                  {s.n}
                </span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {s.title}
                </h3>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', paddingLeft: 24 }}>
                {s.body}
              </p>
            </li>
          ))}
        </ol>

      </div>
      <div className="proposal-scroll-hint">scroll · 5 of 8</div>
    </section>
  );
}
