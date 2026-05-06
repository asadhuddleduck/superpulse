'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * MapWithDots — 62-dot UK silhouette for §2 / §3 / §9.
 *
 * The dots are a hand-tuned grid keyed to rough UK city densities
 * (London cluster, Birmingham, Manchester, Leeds, Glasgow, Bristol etc.).
 * Exact lat/long alignment isn't required — design v1.2 calls these
 * "load-bearing geographic vocabulary," not a navigational map. Tighten
 * positions later by editing DOT_POSITIONS below.
 *
 * Modes:
 *  - mode="all": show all 62 dots. Sonar pulse every `pulseInterval` ms.
 *    `litDots` highlights the indices that should glow viridian; the rest
 *    sit at low opacity (the "92% scrolled past" beat).
 *  - mode="collapse-expand": all dots fade out, single centre dot appears,
 *    then 1 → 3 → 10 → 62 tier reveal with sonar pulse on the final tier.
 *    Used in the IG VO smaller-business bridge (60-second walkthrough).
 *
 * Mobile (390×844): scales via viewBox; dots render at 6px diameter so
 * they stay readable even on thumb-recordings.
 */

const VIEWBOX_W = 360;
const VIEWBOX_H = 480;

// Hand-placed dot positions. Tier-0 = single centre (Birmingham-ish, the
// HD HQ region), tier-1 = next 2 (Manchester, London), tier-2 = next 7
// (Leeds, Glasgow, Bristol, Liverpool, Newcastle, Sheffield, Cardiff).
// Tier-3 fills out to 62 with the rest of the chain footprint.
type Dot = { x: number; y: number; tier: 0 | 1 | 2 | 3; label?: string };

const DOT_POSITIONS: Dot[] = [
  // Tier 0 — single centre (Birmingham region)
  { x: 175, y: 285, tier: 0, label: 'Birmingham' },

  // Tier 1 — Manchester + London
  { x: 170, y: 235, tier: 1, label: 'Manchester' },
  { x: 215, y: 350, tier: 1, label: 'London' },

  // Tier 2 — major cities (rounds out to 10)
  { x: 195, y: 215, tier: 2, label: 'Leeds' },
  { x: 145, y: 130, tier: 2, label: 'Glasgow' },
  { x: 145, y: 360, tier: 2, label: 'Bristol' },
  { x: 150, y: 240, tier: 2, label: 'Liverpool' },
  { x: 195, y: 175, tier: 2, label: 'Newcastle' },
  { x: 185, y: 245, tier: 2, label: 'Sheffield' },
  { x: 130, y: 385, tier: 2, label: 'Cardiff' },

  // Tier 3 — 52 more dots, biased to England with sprinkles in Scotland,
  // Wales, NI to feel like the full chain footprint.
  // London cluster (10 extra — HD has 11 London sites per recon)
  { x: 220, y: 345, tier: 3 },
  { x: 222, y: 352, tier: 3 },
  { x: 213, y: 358, tier: 3 },
  { x: 210, y: 343, tier: 3 },
  { x: 218, y: 360, tier: 3 },
  { x: 207, y: 351, tier: 3 },
  { x: 224, y: 357, tier: 3 },
  { x: 213, y: 365, tier: 3 },
  { x: 226, y: 348, tier: 3 },
  { x: 217, y: 340, tier: 3 },

  // Midlands / north-west clusters (12)
  { x: 162, y: 240, tier: 3 },
  { x: 158, y: 232, tier: 3 },
  { x: 178, y: 230, tier: 3 },
  { x: 165, y: 248, tier: 3 },
  { x: 188, y: 280, tier: 3 },
  { x: 168, y: 290, tier: 3 },
  { x: 192, y: 295, tier: 3 },
  { x: 175, y: 270, tier: 3 },
  { x: 159, y: 280, tier: 3 },
  { x: 184, y: 265, tier: 3 },
  { x: 200, y: 240, tier: 3 },
  { x: 152, y: 255, tier: 3 },

  // Yorkshire / Sheffield / Leeds belt (8)
  { x: 200, y: 220, tier: 3 },
  { x: 188, y: 210, tier: 3 },
  { x: 192, y: 235, tier: 3 },
  { x: 205, y: 210, tier: 3 },
  { x: 178, y: 220, tier: 3 },
  { x: 198, y: 250, tier: 3 },
  { x: 183, y: 255, tier: 3 },
  { x: 210, y: 230, tier: 3 },

  // South coast / Bristol / Reading / Brighton (8)
  { x: 178, y: 360, tier: 3 },
  { x: 195, y: 365, tier: 3 },
  { x: 210, y: 380, tier: 3 },
  { x: 158, y: 370, tier: 3 },
  { x: 165, y: 380, tier: 3 },
  { x: 230, y: 375, tier: 3 },
  { x: 172, y: 350, tier: 3 },
  { x: 200, y: 392, tier: 3 },

  // North-east / Newcastle (4)
  { x: 200, y: 165, tier: 3 },
  { x: 188, y: 180, tier: 3 },
  { x: 205, y: 190, tier: 3 },
  { x: 195, y: 200, tier: 3 },

  // Scotland (5)
  { x: 138, y: 120, tier: 3, label: 'Edinburgh' },
  { x: 158, y: 135, tier: 3 },
  { x: 130, y: 145, tier: 3 },
  { x: 150, y: 110, tier: 3 },
  { x: 122, y: 100, tier: 3 },

  // Wales (3)
  { x: 120, y: 350, tier: 3 },
  { x: 110, y: 320, tier: 3 },
  { x: 135, y: 305, tier: 3 },

  // Northern Ireland (2)
  { x: 80, y: 215, tier: 3, label: 'Belfast' },
  { x: 75, y: 230, tier: 3 },
];

// Sanity check at module load — must be exactly 62.
if (DOT_POSITIONS.length !== 62) {
  // eslint-disable-next-line no-console
  console.warn(`MapWithDots: expected 62 dot positions, got ${DOT_POSITIONS.length}`);
}

export type MapMode = 'all' | 'collapse-expand';

export type MapWithDotsProps = {
  mode?: MapMode;
  /** Indices (0..61) that should glow viridian. Other dots stay dim. */
  litDots?: number[];
  /** Sonar pulse interval in ms. Default 2500. Set to 0 to disable. */
  pulseInterval?: number;
  /** Auto-fire animation on viewport entry. Default true. */
  autoplay?: boolean;
  /** ms to hold each tier in collapse-expand mode. Default 1500. */
  tierHoldMs?: number;
  className?: string;
  /** Override max width for the SVG (default '100%' fluid). */
  width?: number | string;
  /** Show city labels next to tier-0/1/2 dots. Default false. */
  showLabels?: boolean;
};

const VIRIDIAN = '#1EBA8F';
const DIM = 'rgba(255,255,255,0.18)';

export default function MapWithDots({
  mode = 'all',
  litDots,
  pulseInterval = 2500,
  autoplay = true,
  tierHoldMs = 1500,
  className,
  width = '100%',
  showLabels = false,
}: MapWithDotsProps) {
  const prefersReduced = useReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(mode === 'collapse-expand' ? 0 : 3);
  const [collapseStarted, setCollapseStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sonar pulse heartbeat — fires whenever the full map is showing.
  useEffect(() => {
    if (prefersReduced) return;
    if (pulseInterval <= 0) return;
    if (mode === 'collapse-expand' && tier !== 3) return;
    const id = window.setInterval(() => setPulseKey((k) => k + 1), pulseInterval);
    return () => window.clearInterval(id);
  }, [pulseInterval, prefersReduced, mode, tier]);

  // collapse-expand sequence: 1 → 3 → 10 → 62, holding tierHoldMs each.
  useEffect(() => {
    if (mode !== 'collapse-expand') return;
    if (!autoplay) return;
    if (collapseStarted) return;
    setCollapseStarted(true);
    const seq: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];
    let i = 0;
    setTier(seq[i]);
    const id = window.setInterval(() => {
      i++;
      if (i >= seq.length) {
        window.clearInterval(id);
        return;
      }
      setTier(seq[i]);
    }, tierHoldMs);
    return () => window.clearInterval(id);
  }, [mode, autoplay, tierHoldMs, collapseStarted]);

  const litSet = new Set(litDots ?? []);

  // Decide which dots are visible right now.
  const isDotVisible = (dot: Dot): boolean => {
    if (mode === 'all') return true;
    if (tier === 0) return dot.tier === 0;
    if (tier === 1) return dot.tier <= 1;
    if (tier === 2) return dot.tier <= 2;
    return true;
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, position: 'relative', display: 'inline-block' }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label="Map of the United Kingdom showing 62 Heavenly Desserts site locations"
        style={{ display: 'block' }}
      >
        {/* Faint UK silhouette outline to hint at geography without claiming
            cartographic accuracy. A simple irregular polygon is enough. */}
        <path
          d="M 130 90 L 165 100 L 175 130 L 200 145 L 215 175 L 230 200 L 235 235 L 215 265 L 230 290 L 235 325 L 245 360 L 230 395 L 200 415 L 165 405 L 130 385 L 105 350 L 100 305 L 115 270 L 100 240 L 90 205 L 105 170 L 110 130 Z"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        {/* Northern Ireland nub */}
        <path
          d="M 65 200 L 95 195 L 95 235 L 70 240 Z"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Sonar ripple — one synced ring per pulse, applied to all visible
            dots. We render a single SVG layer of expanding circles keyed on
            pulseKey so AnimatePresence + Framer Motion gives us free GPU
            transforms instead of 62 individual rings. */}
        <AnimatePresence>
          {!prefersReduced && tier === 3 && pulseInterval > 0 && (
            <motion.g key={pulseKey}>
              {DOT_POSITIONS.filter(isDotVisible).map((dot, i) => (
                <motion.circle
                  key={`pulse-${i}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={3}
                  fill="none"
                  stroke={VIRIDIAN}
                  strokeWidth={1.5}
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 4, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  style={{ originX: `${dot.x}px`, originY: `${dot.y}px` }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* Dot layer */}
        {DOT_POSITIONS.map((dot, i) => {
          const visible = isDotVisible(dot);
          const lit = litSet.has(i) || mode === 'collapse-expand';
          return (
            <motion.circle
              key={`dot-${i}`}
              cx={dot.x}
              cy={dot.y}
              r={3}
              initial={false}
              animate={{
                opacity: visible ? 1 : 0,
                scale: visible ? 1 : 0.6,
                fill: lit ? VIRIDIAN : DIM,
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                originX: `${dot.x}px`,
                originY: `${dot.y}px`,
                filter: lit && visible ? `drop-shadow(0 0 6px ${VIRIDIAN})` : 'none',
              }}
            />
          );
        })}

        {showLabels && (
          <g>
            {DOT_POSITIONS.map((dot, i) =>
              dot.label && dot.tier <= 2 ? (
                <text
                  key={`lbl-${i}`}
                  x={dot.x + 7}
                  y={dot.y + 3}
                  fontSize={9}
                  fill="rgba(255,255,255,0.55)"
                  fontFamily="system-ui, sans-serif"
                >
                  {dot.label}
                </text>
              ) : null
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
