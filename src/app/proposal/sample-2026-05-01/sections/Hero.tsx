'use client';

import RedactedTape from '@/components/scroll/RedactedTape';
import LogoStrip from '../../heavenly-desserts-2026-04-30/sections/LogoStrip';

// Slide 1 — Hero (redacted). Client name fully covered with red NDA tape
// (zero letter peek-through). Logo strip kept — the trust line stays.

export default function Hero() {
  return (
    <section id="hero">
      <div className="proposal-slide-index">01 / 08</div>
      <div className="proposal-slide-inner" style={{ textAlign: 'center' }}>
        <p className="proposal-eyebrow">
          For <RedactedTape stamp="NDA">Heavenly Desserts</RedactedTape> · April 2026
        </p>
        <h1 className="proposal-h1">
          How to put <RedactedTape>Heavenly Desserts</RedactedTape> in front of{' '}
          <strong style={{ color: 'var(--viridian)' }}>3.4 million locals</strong>{' '}
          next month, for less than{' '}
          <strong style={{ color: 'var(--viridian)' }}>1% of your rent</strong>.
          Without making a single new piece of content.
        </h1>
        <p className="proposal-subhead" style={{ margin: '0 auto 28px' }}>
          A quiet system that takes the posts you already make and shows
          them to nearby people, again and again, every week.
        </p>
        <div style={{ marginTop: 24 }}>
          <LogoStrip label="trusted by smart UK food chains" />
        </div>
        <p
          style={{
            marginTop: 22,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Sample · Client identity redacted
        </p>
      </div>
      <div className="proposal-scroll-hint">scroll · 1 of 8</div>
    </section>
  );
}
