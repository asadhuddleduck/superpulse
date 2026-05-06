'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from 'framer-motion';

/**
 * OfferReveal — the §6 receipt animation.
 *
 * Sequence (design v1.2 §6, Imran's section / visual climax):
 *  1. Receipt slides up from bottom (300ms ease-out — fast spec from team-lead;
 *     design doc itself slows to 800ms for Imran's tempo, exposed via prop).
 *  2. Line items animate in one at a time with 200ms stagger
 *     (slowed to 280ms when `tempo="imran"`).
 *  3. Thick viridian line draws across (400ms scaleX 0→1, origin: left).
 *  4. Redacted-rent line — uniform-width sandstorm blocks for the £-figure,
 *     legal-document-boring per advocate v1.3. Holds 1.5s on screen.
 *  5. "Superpulse: ~1% of that" — "~1%" pulses in viridian, then a 2px
 *     viridian underline draws beneath over 700ms (scaleX, origin left).
 *     NO glow-bloom (v1.2 swap). Underline holds + slow-breathes (5s sine).
 *  6. 600ms after underline settles: "Switch on: TODAY" fades in below the
 *     receipt. RampVisualisation ticks 0:00 → 0:01 over 800ms beside TODAY.
 *     A 2px viridian underline draws beneath the entire line over 700ms.
 *     LiveDot at the right edge breathes (in sync with §10 button).
 *
 * Props are intentionally narrow — the section's text is locked by sabri's
 * v0.6 copy (§6 Imran's section) so we hard-code the line content. If you
 * need to swap copy, edit the constants below; don't add overrides.
 */

const VIRIDIAN = '#1EBA8F';
const SANDSTORM = '#F7CE46';
const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

export type OfferRevealProps = {
  /** 'fast' = team-lead's brief (300ms slide, 200ms stagger). 'imran' = design doc tempo (800ms slide, 280ms stagger, 1.5s redaction hold). Default 'fast'. */
  tempo?: 'fast' | 'imran';
  /** Trigger on viewport entry. Default true. */
  triggerOnInView?: boolean;
  /** Optional className for the outer wrapper (sizing, max-width, etc.). */
  className?: string;
  /**
   * v1.3 §6 sub-stat — optional line that fades in 800ms after the
   * switch-on countdown underline settles. Designed for "11 of your 62
   * sites sit in London — where you're scaling next." 12px, secondary
   * text colour, no animation beyond the fade-up. Omit to skip cleanly
   * (no layout impact).
   */
  londonSubStat?: string;
};

type Phase =
  | 'idle'
  | 'slide-in'
  | 'line-1'
  | 'line-2'
  | 'rule'
  | 'rent'
  | 'one-percent'
  | 'one-percent-underline'
  | 'switch-on'
  | 'ticker'
  | 'switch-on-underline'
  | 'london-substat'
  | 'settled';

const TEMPOS = {
  fast: {
    slideMs: 300,
    lineStagger: 200,
    redactionHoldMs: 600,
    ruleMs: 400,
  },
  imran: {
    slideMs: 800,
    lineStagger: 280,
    redactionHoldMs: 1500,
    ruleMs: 800,
  },
} as const;

export default function OfferReveal({
  tempo = 'fast',
  triggerOnInView = true,
  className,
  londonSubStat,
}: OfferRevealProps) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const t = TEMPOS[tempo];

  const [phase, setPhase] = useState<Phase>('idle');
  const [tickerValue, setTickerValue] = useState('0:00');
  const [hasFired, setHasFired] = useState(false);

  useEffect(() => {
    if (hasFired) return;
    if (triggerOnInView && !inView) return;
    setHasFired(true);
  }, [triggerOnInView, inView, hasFired]);

  // Reduced-motion: jump straight to settled state.
  useEffect(() => {
    if (prefersReduced && hasFired) {
      setPhase('settled');
      setTickerValue('0:01');
    }
  }, [prefersReduced, hasFired]);

  // Phase timeline. Each phase fires on a setTimeout chain — clearer than
  // chaining onAnimationComplete callbacks because some beats (the 1.5s
  // redaction hold, the 600ms gap before switch-on) aren't tied to an
  // animation finishing.
  useEffect(() => {
    if (!hasFired || prefersReduced) return;
    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(id);
    };

    setPhase('slide-in');
    let cursor = t.slideMs;
    at(cursor, () => setPhase('line-1'));
    cursor += t.lineStagger;
    at(cursor, () => setPhase('line-2'));
    cursor += t.lineStagger;
    at(cursor, () => setPhase('rule'));
    cursor += t.ruleMs;
    at(cursor, () => setPhase('rent'));
    cursor += t.redactionHoldMs;
    at(cursor, () => setPhase('one-percent'));
    cursor += 350; // pulse-in time
    at(cursor, () => setPhase('one-percent-underline'));
    cursor += 700; // underline draw
    cursor += 600; // gap before switch-on
    at(cursor, () => setPhase('switch-on'));
    cursor += 250;
    at(cursor, () => setPhase('ticker'));
    // Ticker animation runs 800ms — we'll drive the value via interval inside
    // the ticker phase below. Wait for it to finish before underlining.
    cursor += 800;
    at(cursor, () => setPhase('switch-on-underline'));
    cursor += 700; // underline draw
    cursor += 800; // gap before London sub-stat per v1.3
    at(cursor, () => setPhase('london-substat'));
    cursor += 600; // sub-stat fade-up
    at(cursor, () => setPhase('settled'));

    return () => {
      cancelled = true;
      for (const id of timers) window.clearTimeout(id);
    };
  }, [hasFired, prefersReduced, t]);

  // Ticker animation — runs 800ms from "0:00" to "0:01" once we hit the
  // ticker phase. Single-step is enough; the rhetorical beat is the *count
  // happening live*, not the granularity.
  useEffect(() => {
    if (phase !== 'ticker') return;
    if (prefersReduced) {
      setTickerValue('0:01');
      return;
    }
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      // Single tick — flip from 0 to 1 at p > 0.5 for a chunky "live"
      // feeling rather than smooth interpolation.
      setTickerValue(p < 0.5 ? '0:00' : '0:01');
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, prefersReduced]);

  const showLine1 = phaseAtLeast(phase, 'line-1');
  const showLine2 = phaseAtLeast(phase, 'line-2');
  const showRule = phaseAtLeast(phase, 'rule');
  const showRent = phaseAtLeast(phase, 'rent');
  const showOnePercent = phaseAtLeast(phase, 'one-percent');
  const showOnePercentUnderline = phaseAtLeast(phase, 'one-percent-underline');
  const showSwitchOn = phaseAtLeast(phase, 'switch-on');
  const showTicker = phaseAtLeast(phase, 'ticker');
  const showSwitchOnUnderline = phaseAtLeast(phase, 'switch-on-underline');
  const showLondonSubStat = phaseAtLeast(phase, 'london-substat');

  return (
    <div ref={ref} className={className} style={{ width: '100%' }}>
      {/* Receipt card */}
      <motion.div
        initial={prefersReduced ? false : { y: '100%', opacity: 0 }}
        animate={
          hasFired
            ? { y: 0, opacity: 1 }
            : prefersReduced
              ? { y: 0, opacity: 1 }
              : { y: '100%', opacity: 0 }
        }
        transition={{ duration: t.slideMs / 1000, ease: EASE_PREMIUM }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${SANDSTORM}`,
          borderRadius: 12,
          padding: '32px 28px',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          width: '92%',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        {/* Line 1 */}
        <ReceiptLine show={showLine1}>
          62 sites × £5/day ={' '}
          <span style={{ fontSize: '1.4em', fontWeight: 800 }}>£310/day</span>
        </ReceiptLine>

        {/* Line 2 */}
        <ReceiptLine show={showLine2} mt={12}>
          × 30 days ={' '}
          <span style={{ fontSize: '1.4em', fontWeight: 800 }}>£9,300/month</span>
        </ReceiptLine>

        {/* Viridian rule */}
        <motion.div
          initial={false}
          animate={{ scaleX: showRule ? 1 : 0 }}
          transition={{ duration: t.ruleMs / 1000, ease: EASE_PREMIUM }}
          style={{
            transformOrigin: 'left center',
            height: 3,
            background: VIRIDIAN,
            margin: '20px 0',
            borderRadius: 1.5,
          }}
        />

        {/* Redacted rent line */}
        <ReceiptLine show={showRent} mt={4}>
          Your rent bill: £
          <RedactedBlock count={6} />
          /month. Superpulse:{' '}
          <span style={{ display: 'inline-block', position: 'relative' }}>
            <motion.span
              initial={false}
              animate={
                showOnePercent
                  ? { opacity: 1, scale: [1.0, 1.08, 1.0], color: VIRIDIAN }
                  : { opacity: 0, scale: 1, color: VIRIDIAN }
              }
              transition={{ duration: 0.35, ease: EASE_PREMIUM }}
              style={{ display: 'inline-block', fontWeight: 800 }}
            >
              ~1%
            </motion.span>{' '}
            of that
            <motion.span
              initial={false}
              animate={{ scaleX: showOnePercentUnderline ? 1 : 0 }}
              transition={{ duration: 0.7, ease: EASE_PREMIUM }}
              style={{
                position: 'absolute',
                left: 0,
                bottom: -6,
                height: 2,
                width: '2.5em', // span only beneath "~1%"
                background: VIRIDIAN,
                opacity: 0.7,
                transformOrigin: 'left center',
                animation: showOnePercentUnderline
                  ? 'sp-underline-breathe 5s ease-in-out infinite'
                  : undefined,
              }}
            />
          </span>
        </ReceiptLine>
      </motion.div>

      {/* Switch-on countdown line — sits below the receipt */}
      <motion.div
        initial={false}
        animate={{ opacity: showSwitchOn ? 1 : 0, y: showSwitchOn ? 0 : 8 }}
        transition={{ duration: 0.25, ease: EASE_PREMIUM }}
        style={{
          marginTop: 20,
          textAlign: 'center',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 18,
          fontWeight: 600,
          position: 'relative',
          display: 'inline-flex',
          gap: 12,
          alignItems: 'baseline',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <span>
          Switch on: <span style={{ color: VIRIDIAN, fontWeight: 800 }}>TODAY</span>
        </span>
        <AnimatePresence>
          {showTicker && (
            <motion.span
              key="ticker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: VIRIDIAN,
                fontSize: 16,
              }}
              aria-live="polite"
            >
              {tickerValue}
            </motion.span>
          )}
        </AnimatePresence>
        <LiveDot active={showTicker} />
        {/* Full-width underline drawing beneath the entire switch-on line */}
        <motion.span
          initial={false}
          animate={{ scaleX: showSwitchOnUnderline ? 1 : 0 }}
          transition={{ duration: 0.7, ease: EASE_PREMIUM }}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: -8,
            height: 2,
            width: '70%',
            maxWidth: 400,
            background: VIRIDIAN,
            opacity: 0.7,
            transformOrigin: 'left center',
            animation: showSwitchOnUnderline
              ? 'sp-underline-breathe 5s ease-in-out infinite'
              : undefined,
          }}
        />
      </motion.div>

      {/* London 11/62 sub-stat — v1.3, optional. No animation beyond the
          fade-up; settles and stays. Skipped cleanly when prop is omitted. */}
      {londonSubStat && (
        <motion.div
          initial={false}
          animate={{
            opacity: showLondonSubStat ? 1 : 0,
            y: showLondonSubStat ? 0 : 6,
          }}
          transition={{ duration: 0.6, ease: EASE_PREMIUM }}
          style={{
            marginTop: 20,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 12,
            lineHeight: 1.5,
            maxWidth: 420,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {londonSubStat}
        </motion.div>
      )}

      {/* Local keyframes — scoped to this component, no globals.css edits. */}
      <style>{`
        @keyframes sp-underline-breathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        @keyframes sp-livedot-breathe {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </div>
  );
}

function ReceiptLine({
  show,
  mt = 0,
  children,
}: {
  show: boolean;
  mt?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 8 }}
      transition={{ duration: 0.25, ease: EASE_PREMIUM }}
      style={{
        marginTop: mt,
        fontSize: 18,
        lineHeight: 1.5,
      }}
    >
      {children}
    </motion.div>
  );
}

function RedactedBlock({ count }: { count: number }) {
  // Uniform-width sandstorm censorship blocks. "Legal-document boring" —
  // no decorative angle, no animation, baseline-aligned. Each block is
  // approximately the average character width of the surrounding font.
  return (
    <span
      aria-label="redacted"
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        color: SANDSTORM,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: 0,
        userSelect: 'none',
      }}
    >
      {'█'.repeat(count)}
    </span>
  );
}

function LiveDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: VIRIDIAN,
        boxShadow: `0 0 6px ${VIRIDIAN}`,
        opacity: active ? 1 : 0,
        transition: 'opacity 0.25s ease-out',
        animation: active ? 'sp-livedot-breathe 1.5s ease-in-out infinite' : undefined,
        alignSelf: 'center',
      }}
    />
  );
}

const PHASE_ORDER: Phase[] = [
  'idle',
  'slide-in',
  'line-1',
  'line-2',
  'rule',
  'rent',
  'one-percent',
  'one-percent-underline',
  'switch-on',
  'ticker',
  'switch-on-underline',
  'london-substat',
  'settled',
];

function phaseAtLeast(phase: Phase, target: Phase): boolean {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(target);
}
