'use client';

import LogoStrip from './LogoStrip';

// Slide 1 — Hero. Beautiful and serious. Big-promise headline + logo
// strip. No animation on the text. HD photo placement: this is the
// only slide WITHOUT a background photo, so the headline gets full
// weight. Photos appear later in the deck for variety.

export default function Hero() {
  return (
    <section id="hero">
      <div className="proposal-slide-index">01 / 08</div>
      <div className="proposal-slide-inner" style={{ textAlign: 'center' }}>
        <p className="proposal-eyebrow">For Heavenly Desserts · April 2026</p>
        <h1 className="proposal-h1">
          How to put Heavenly Desserts in front of{' '}
          <strong style={{ color: 'var(--viridian)' }}>3.4 million locals</strong>{' '}
          next month, for less than{' '}
          <strong style={{ color: 'var(--viridian)' }}>1% of your rent</strong>.
          Without making a single new piece of content.
        </h1>
        <p className="proposal-subhead" style={{ margin: '0 auto 28px' }}>
          A quiet system that takes the posts you already make and shows
          them to nearby people, again and again, every week.
        </p>
        <div style={{ marginTop: 32 }}>
          <LogoStrip label="trusted by smart UK food chains" />
        </div>
      </div>
      <div className="proposal-scroll-hint">scroll · 1 of 8</div>
    </section>
  );
}
