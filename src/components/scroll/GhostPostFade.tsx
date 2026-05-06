'use client';

// Always-on looping infographic: an Instagram post tile that fades from
// full colour to ghosted-out grey over a fake 24-hour cycle. The
// "HOUR XX of 24" ticker counts in sync via a pure-CSS scrolling
// column of 25 lines (00 → 24), so it works even when client JS
// doesn't hydrate (Next 16 dev + broken HMR scenarios).

const HOURS = Array.from({ length: 25 }, (_, i) => String(i).padStart(2, '0'));

export default function GhostPostFade({ size = 200 }: { size?: number }) {
  const headerH = 28;
  const footerH = 30;
  const imgH = size;

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ position: 'relative', width: size }}>
        <div
          className="proposal-ghost-tile"
          style={{
            width: size,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0D0D0D',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        {/* IG header row */}
        <div
          style={{
            height: headerH,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
              padding: 1.5,
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0D0D0D' }} />
          </div>
          <div style={{ width: 70, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.55)' }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 14, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.4)' }} />
        </div>

        {/* The image */}
        <div
          style={{
            width: '100%',
            height: imgH - headerH - footerH,
            background: 'linear-gradient(135deg, var(--viridian) 0%, var(--sandstorm) 100%)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '30%',
              left: '25%',
              width: '50%',
              height: '40%',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              filter: 'blur(8px)',
            }}
          />
        </div>

        {/* Footer row */}
        <div
          style={{
            height: footerH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        </div>

        {/* Skull overlay — outside the fading tile so it stays opaque */}
        <div className="proposal-ghost-skull" aria-hidden="true">💀</div>
      </div>

      {/* CSS-only ticker */}
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 4,
          lineHeight: 1,
        }}
      >
        <span>Hour</span>
        <span className="proposal-ghost-clock">
          <span className="proposal-ghost-clock-track">
            {HOURS.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </span>
        </span>
        <span>of 24</span>
      </div>
    </div>
  );
}
