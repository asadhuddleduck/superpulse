'use client';

import GhostPostFade from '@/components/scroll/GhostPostFade';

// Slide 3 — Problem. Simple, 5th-grade. The looping ghost-post-fade
// infographic carries the visual weight. Text is a single short
// thought.

export default function Problem() {
  return (
    <section id="problem">
      <div className="proposal-slide-index">03 / 08</div>
      <div className="proposal-slide-inner">
        <p className="proposal-eyebrow">The problem</p>
        <h2 className="proposal-h2">
          You spend a fortune on every post. Most of it dies in 24 hours.
        </h2>
        <p className="proposal-body">
          A photo shoot. A chef. An edit. A caption. A ton of time. Your
          team posts it. Your followers see it once. Most of them don&apos;t
          even live near a Heavenly Desserts. The next day, the post is
          gone. And you start again.
        </p>

        <div style={{ marginTop: 18 }}>
          <GhostPostFade size={170} />
        </div>
      </div>
      <div className="proposal-scroll-hint">scroll · 3 of 8</div>
    </section>
  );
}
