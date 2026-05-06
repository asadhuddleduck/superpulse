'use client';

// Always-on looping infographic: a horizontal path of 3 dots with a
// travelling spark that pulses from left to right and back. Used on
// the How It Works slide to visualise post → engine → local.

interface PathOfLightProps {
  steps?: string[];
}

export default function PathOfLight({
  steps = ['You post', 'Superpulse picks', 'Locals see it'],
}: PathOfLightProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        maxWidth: 360,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <svg viewBox="0 0 360 80" width="100%" style={{ display: 'block' }}>
        {/* Connecting line */}
        <line
          x1="40"
          y1="40"
          x2="320"
          y2="40"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
        />

        {/* Three station dots */}
        {[40, 180, 320].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy="40" r="14" fill="var(--black-card)" stroke="var(--viridian)" strokeWidth="1.5" />
            <circle cx={cx} cy="40" r="4" fill="var(--viridian)" />
          </g>
        ))}

        {/* Travelling spark */}
        <circle r="6" fill="var(--sandstorm)" opacity="0.95">
          <animateMotion dur="3.6s" repeatCount="indefinite" rotate="auto">
            <mpath xlinkHref="#spark-path" />
          </animateMotion>
          <animate attributeName="opacity" values="0.95;1;0.95" dur="3.6s" repeatCount="indefinite" />
        </circle>
        <path id="spark-path" d="M 40 40 L 320 40 L 40 40" fill="none" />

        {/* Glow trail behind spark */}
        <circle r="10" fill="var(--sandstorm)" opacity="0.25">
          <animateMotion dur="3.6s" repeatCount="indefinite">
            <mpath xlinkHref="#spark-path" />
          </animateMotion>
        </circle>
      </svg>

      {/* Step labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {steps.map((s, i) => (
          <span key={i} style={{ flex: '0 0 33%', textAlign: i === 1 ? 'center' : i === 0 ? 'left' : 'right' }}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
