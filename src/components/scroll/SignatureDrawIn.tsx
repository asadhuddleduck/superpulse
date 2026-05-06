'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * SignatureDrawIn — §10 CTA close-of-letter primitive.
 *
 * Renders one or more SVG signature paths and "draws" them in via
 * stroke-dasharray / stroke-dashoffset on viewport entry. One-shot — settles
 * static. No idle loop, no breathing, no wave (advocate v1.3 killed the wave).
 *
 * If `paths` is empty (no asset shipped), the primitive renders the
 * fallback: a typeset script-style line in viridian. This keeps §10 alive
 * even before Asad's signature SVG lands.
 *
 * The first path determines the visual length the draw uses for its dash
 * cycle. We measure each path on mount to set its individual dasharray
 * length so multi-stroke signatures (initials + flourish) draw cleanly.
 */

const VIRIDIAN = '#1EBA8F';
const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type SignatureDrawInProps = {
  /** SVG path d-strings. Empty array → typeset fallback renders. */
  paths: string[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Stroke colour. Default viridian at 70% opacity (per design v1.3). */
  colour?: string;
  /** Total draw duration in ms. Default 800. */
  durationMs?: number;
  /** Fallback text shown if paths is empty. */
  fallbackText?: string;
  className?: string;
  /** SVG viewBox — defaults to "0 0 {width} {height}". Override for tightly-cropped signatures. */
  viewBox?: string;
};

export default function SignatureDrawIn({
  paths,
  width = 120,
  height = 40,
  strokeWidth = 2,
  colour = VIRIDIAN,
  durationMs = 800,
  fallbackText = 'Asad Shah',
  className,
  viewBox,
}: SignatureDrawInProps) {
  const prefersReduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [pathLengths, setPathLengths] = useState<number[]>([]);

  // Measure each path's geometric length once it's mounted so the dash
  // animation reveals the full stroke regardless of path complexity.
  useEffect(() => {
    if (paths.length === 0) return;
    const lengths = pathRefs.current.map((el) => (el ? el.getTotalLength() : 0));
    setPathLengths(lengths);
  }, [paths]);

  // Fallback path — typeset script line. Reads as a signed close, ships
  // even when the SVG asset isn't ready.
  if (paths.length === 0) {
    return (
      <motion.div
        ref={containerRef}
        className={className}
        initial={{ opacity: 0 }}
        animate={inView || prefersReduced ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: prefersReduced ? 0 : 0.6, ease: EASE_PREMIUM }}
        style={{
          fontFamily:
            "'Caveat', 'Brush Script MT', 'Snell Roundhand', cursive, system-ui, sans-serif",
          fontSize: 28,
          color: colour,
          lineHeight: 1.2,
        }}
      >
        {fallbackText}
      </motion.div>
    );
  }

  const fire = inView && pathLengths.length === paths.length;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
      <svg
        width={width}
        height={height}
        viewBox={viewBox ?? `0 0 ${width} ${height}`}
        fill="none"
        stroke={colour}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Asad Shah signature"
        role="img"
      >
        {paths.map((d, i) => {
          const length = pathLengths[i] ?? 1000;
          // If reduced motion: render the path with no dash offset so it
          // appears fully drawn immediately. If not yet measured: hide via
          // dashoffset = length until measurement completes.
          const initial = prefersReduced ? 0 : length;
          return (
            <motion.path
              key={i}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              d={d}
              style={{
                strokeDasharray: length || 1000,
                strokeDashoffset: initial,
              }}
              initial={false}
              animate={{
                strokeDashoffset: fire || prefersReduced ? 0 : length,
              }}
              transition={{
                duration: prefersReduced ? 0 : durationMs / 1000,
                ease: EASE_PREMIUM,
                // Stagger slightly so multi-stroke signatures feel hand-written.
                delay: prefersReduced ? 0 : (i * durationMs * 0.15) / 1000,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
