'use client';

// Always-on looping infographic: a stylised local-area map with a
// Heavenly Desserts shop pin in the centre and concentric viridian
// rings pulsing outward forever. The map underlay (street grid +
// blocks) makes it read as "this is your local area" instead of an
// abstract target. CSS-only animation, GPU-cheap.

export default function PulsingRadius({ size = 280, label = 'each Heavenly Desserts' }: { size?: number; label?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        position: 'relative',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        <defs>
          <radialGradient id="pulse-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(30,186,143,0.4)" />
            <stop offset="100%" stopColor="rgba(30,186,143,0)" />
          </radialGradient>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="80%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.9)" />
          </radialGradient>
          <clipPath id="map-clip">
            <circle cx="100" cy="100" r="92" />
          </clipPath>
        </defs>

        {/* Map underlay */}
        <g clipPath="url(#map-clip)">
          {/* Background tile */}
          <rect x="0" y="0" width="200" height="200" fill="#0A1614" />

          {/* Block shapes (buildings / parks) */}
          <rect x="22" y="28" width="34" height="22" fill="#0F1F1B" />
          <rect x="60" y="22" width="44" height="28" fill="#0F1F1B" />
          <rect x="110" y="32" width="30" height="18" fill="#0F1F1B" />
          <rect x="146" y="26" width="32" height="30" fill="#0F1F1B" />
          <rect x="18" y="58" width="40" height="36" fill="#0F1F1B" />
          <rect x="62" y="58" width="32" height="22" fill="#11241F" />
          <rect x="120" y="58" width="58" height="28" fill="#0F1F1B" />
          <rect x="20" y="100" width="32" height="32" fill="#0F1F1B" />
          <rect x="56" y="92" width="38" height="22" fill="#0F1F1B" />
          <rect x="118" y="96" width="28" height="34" fill="#0F1F1B" />
          <rect x="150" y="92" width="30" height="42" fill="#0F1F1B" />
          <rect x="22" y="140" width="46" height="28" fill="#0F1F1B" />
          <rect x="74" y="138" width="38" height="32" fill="#0F1F1B" />
          <rect x="118" y="140" width="32" height="28" fill="#0F1F1B" />
          <rect x="156" y="142" width="22" height="30" fill="#0F1F1B" />

          {/* Streets — horizontal */}
          <line x1="0" y1="54" x2="200" y2="54" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />
          <line x1="0" y1="88" x2="200" y2="88" stroke="rgba(30,186,143,0.22)" strokeWidth="0.9" />
          <line x1="0" y1="118" x2="200" y2="118" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />
          <line x1="0" y1="136" x2="200" y2="136" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />

          {/* Streets — vertical */}
          <line x1="58" y1="0" x2="58" y2="200" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />
          <line x1="98" y1="0" x2="98" y2="200" stroke="rgba(30,186,143,0.22)" strokeWidth="0.9" />
          <line x1="116" y1="0" x2="116" y2="200" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />
          <line x1="148" y1="0" x2="148" y2="200" stroke="rgba(30,186,143,0.18)" strokeWidth="0.7" />

          {/* A diagonal road for character */}
          <line x1="0" y1="180" x2="200" y2="20" stroke="rgba(30,186,143,0.12)" strokeWidth="0.6" />

          {/* Subtle vignette to fade map edges into black */}
          <rect x="0" y="0" width="200" height="200" fill="url(#map-vignette)" />
        </g>

        {/* Soft circular border */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(30,186,143,0.2)" strokeWidth="0.6" />

        {/* Three pulsing rings, staggered */}
        <circle cx="100" cy="100" r="20" fill="none" stroke="var(--viridian)" strokeWidth="1" opacity="0.6">
          <animate attributeName="r" from="20" to="90" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="3s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" from="2" to="0.5" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="20" fill="none" stroke="var(--viridian)" strokeWidth="1" opacity="0.6">
          <animate attributeName="r" from="20" to="90" dur="3s" begin="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin="1s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" from="2" to="0.5" dur="3s" begin="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="100" cy="100" r="20" fill="none" stroke="var(--viridian)" strokeWidth="1" opacity="0.6">
          <animate attributeName="r" from="20" to="90" dur="3s" begin="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-width" from="2" to="0.5" dur="3s" begin="2s" repeatCount="indefinite" />
        </circle>

        {/* Soft inner glow */}
        <circle cx="100" cy="100" r="32" fill="url(#pulse-grad)" />

        {/* Centre pin: a stylised Heavenly Desserts marker */}
        <circle cx="100" cy="100" r="10" fill="var(--viridian)" />
        <circle cx="100" cy="100" r="4" fill="#000" />
      </svg>
      <div
        style={{
          fontSize: 9,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    </div>
  );
}
