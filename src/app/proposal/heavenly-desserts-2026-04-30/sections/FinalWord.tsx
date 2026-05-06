'use client';

// Slide 8 — Final word. Quiet, generous, no pressure. No CTA button.
// No photo. Just the closing line — the whole deck ends on respect.

export default function FinalWord() {
  return (
    <section id="final">
      <div className="proposal-slide-index">08 / 08</div>
      <div className="proposal-slide-inner" style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center', paddingTop: 0 }}>
        <p className="proposal-eyebrow">That&apos;s it</p>
        <h2 className="proposal-h2">
          Reply to your partner. We&apos;ll take it from there.
        </h2>
        <p className="proposal-subhead" style={{ margin: '0 auto', maxWidth: 460 }}>
          No deck to download. No call to book. Just a quiet yes when you&apos;re ready.
        </p>
      </div>
    </section>
  );
}
