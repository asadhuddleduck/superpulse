'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from 'framer-motion';

/**
 * KineticHeadline — dual-mode masked-headline reveal.
 *
 * mode="sentence": one continuous left-to-right mask-clip wipe over 700ms.
 *   Used in the soft hero H1 and §3 H2.
 *
 * mode="stack": per-word mask-clip wipe across N lines with lineDelays
 *   + per-word stagger. Supports an embedded counter slot — pass a token in
 *   the line of the form "{counter:0}" and inject the React node via
 *   counterSlots[0]. Used in §4 framing block to host the ramping "558".
 *
 * a11y: the wrapping h1/h2 sets aria-label = the full intended text
 * (REQUIRED per design v1.2). All animated word/sentence spans inside are
 * aria-hidden so screen readers don't read fragmented text. If
 * prefers-reduced-motion: reduce, animations are skipped — final state
 * renders immediately.
 */

const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

type CommonProps = {
  ariaLabel: string;
  delay?: number;
  idle?: 'none' | 'breathe';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
  triggerOnInView?: boolean;
  onSettled?: () => void;
};

type SentenceProps = CommonProps & {
  mode: 'sentence';
  text: string;
  durationMs?: number;
};

type StackProps = CommonProps & {
  mode: 'stack';
  text: string[];
  lineDelays?: number[];
  staggerMs?: number;
  wordDurationMs?: number;
  counterSlots?: React.ReactNode[];
};

export type KineticHeadlineProps = SentenceProps | StackProps;

const COUNTER_TOKEN_RE = /\{counter:(\d+)\}/g;

type Token = { kind: 'word'; value: string } | { kind: 'counter'; idx: number };

function tokenizeLine(line: string): Token[] {
  const parts: Token[] = [];
  let lastIndex = 0;
  const re = new RegExp(COUNTER_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > lastIndex) {
      const chunk = line.slice(lastIndex, m.index);
      for (const w of chunk.split(/\s+/).filter(Boolean)) {
        parts.push({ kind: 'word', value: w });
      }
    }
    parts.push({ kind: 'counter', idx: parseInt(m[1], 10) });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < line.length) {
    const chunk = line.slice(lastIndex);
    for (const w of chunk.split(/\s+/).filter(Boolean)) {
      parts.push({ kind: 'word', value: w });
    }
  }
  return parts;
}

const idleVariants: Variants = {
  rest: { scale: 1 },
  breathe: {
    scale: [1, 1.005, 1],
    transition: {
      duration: 4,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

export default function KineticHeadline(props: KineticHeadlineProps) {
  const {
    ariaLabel,
    delay = 0,
    idle = 'breathe',
    as = 'h1',
    className,
    triggerOnInView = false,
    onSettled,
  } = props;
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [hasFired, setHasFired] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (hasFired) return;
    if (triggerOnInView && !inView) return;
    setHasFired(true);
  }, [triggerOnInView, inView, hasFired]);

  const Tag = motion[as];

  if (prefersReduced) {
    return (
      <Tag ref={ref} aria-label={ariaLabel} className={className}>
        <span aria-hidden="true">
          {props.mode === 'sentence'
            ? props.text
            : props.text.map((line, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {renderLineStaticWithCounters(line, props.counterSlots)}
                </span>
              ))}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      aria-label={ariaLabel}
      className={className}
      variants={idleVariants}
      initial="rest"
      animate={introDone && idle === 'breathe' ? 'breathe' : 'rest'}
    >
      <span aria-hidden="true" style={{ display: 'inline-block' }}>
        {props.mode === 'sentence' ? (
          <SentenceWipe
            text={props.text}
            fire={hasFired}
            delay={delay}
            durationMs={props.durationMs ?? 700}
            onSettled={() => {
              setIntroDone(true);
              onSettled?.();
            }}
          />
        ) : (
          <StackWipe
            lines={props.text}
            fire={hasFired}
            delay={delay}
            lineDelays={props.lineDelays}
            staggerMs={props.staggerMs ?? 80}
            wordDurationMs={props.wordDurationMs ?? 200}
            counterSlots={props.counterSlots}
            onSettled={() => {
              setIntroDone(true);
              onSettled?.();
            }}
          />
        )}
      </span>
    </Tag>
  );
}

function SentenceWipe({
  text,
  fire,
  delay,
  durationMs,
  onSettled,
}: {
  text: string;
  fire: boolean;
  delay: number;
  durationMs: number;
  onSettled: () => void;
}) {
  return (
    <motion.span
      style={{
        display: 'inline-block',
        clipPath: 'inset(0 100% 0 0)',
        WebkitClipPath: 'inset(0 100% 0 0)',
      }}
      initial={false}
      animate={
        fire
          ? { clipPath: 'inset(0 0% 0 0)' }
          : { clipPath: 'inset(0 100% 0 0)' }
      }
      transition={{
        duration: durationMs / 1000,
        ease: EASE_PREMIUM,
        delay: delay / 1000,
      }}
      onAnimationComplete={() => {
        if (fire) onSettled();
      }}
    >
      {text}
    </motion.span>
  );
}

function StackWipe({
  lines,
  fire,
  delay,
  lineDelays,
  staggerMs,
  wordDurationMs,
  counterSlots,
  onSettled,
}: {
  lines: string[];
  fire: boolean;
  delay: number;
  lineDelays?: number[];
  staggerMs: number;
  wordDurationMs: number;
  counterSlots?: React.ReactNode[];
  onSettled: () => void;
}) {
  const tokenizedLines = useMemo(() => lines.map(tokenizeLine), [lines]);
  const totalDurationMs = useMemo(() => {
    let last = 0;
    tokenizedLines.forEach((tokens, lineIdx) => {
      const lineDelay = lineDelays?.[lineIdx] ?? lineIdx * 300;
      const wordCount = tokens.filter((t) => t.kind === 'word').length;
      const lineLast = lineDelay + Math.max(0, wordCount - 1) * staggerMs + wordDurationMs;
      if (lineLast > last) last = lineLast;
    });
    return last;
  }, [tokenizedLines, lineDelays, staggerMs, wordDurationMs]);

  useEffect(() => {
    if (!fire) return;
    const t = window.setTimeout(onSettled, delay + totalDurationMs);
    return () => window.clearTimeout(t);
  }, [fire, delay, totalDurationMs, onSettled]);

  return (
    <>
      {tokenizedLines.map((tokens, lineIdx) => {
        const lineDelay = lineDelays?.[lineIdx] ?? lineIdx * 300;
        let wordCounter = 0;
        return (
          <span key={lineIdx} style={{ display: 'block' }}>
            {tokens.map((token, tIdx) => {
              if (token.kind === 'counter') {
                const counterDelayMs = delay + lineDelay;
                return (
                  <motion.span
                    key={`c-${tIdx}`}
                    style={{ display: 'inline-block' }}
                    initial={{ opacity: 0 }}
                    animate={fire ? { opacity: 1 } : { opacity: 0 }}
                    transition={{
                      duration: 0.2,
                      ease: EASE_PREMIUM,
                      delay: counterDelayMs / 1000,
                    }}
                  >
                    {counterSlots?.[token.idx] ?? null}
                  </motion.span>
                );
              }
              const wordIdx = wordCounter++;
              const wordDelayMs = delay + lineDelay + wordIdx * staggerMs;
              return (
                <span
                  key={`w-${tIdx}`}
                  style={{ display: 'inline-block', whiteSpace: 'pre' }}
                >
                  <motion.span
                    style={{
                      display: 'inline-block',
                      clipPath: 'inset(0 100% 0 0)',
                      WebkitClipPath: 'inset(0 100% 0 0)',
                    }}
                    initial={false}
                    animate={
                      fire
                        ? { clipPath: 'inset(0 0% 0 0)' }
                        : { clipPath: 'inset(0 100% 0 0)' }
                    }
                    transition={{
                      duration: wordDurationMs / 1000,
                      ease: EASE_PREMIUM,
                      delay: wordDelayMs / 1000,
                    }}
                  >
                    {token.value}
                  </motion.span>
                  {tIdx < tokens.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

function renderLineStaticWithCounters(line: string, counterSlots?: React.ReactNode[]) {
  const tokens = tokenizeLine(line);
  return tokens.map((tok, i) => {
    if (tok.kind === 'counter') {
      return <span key={i}>{counterSlots?.[tok.idx] ?? null}</span>;
    }
    return (
      <span key={i} style={{ whiteSpace: 'pre' }}>
        {tok.value}
        {i < tokens.length - 1 ? ' ' : ''}
      </span>
    );
  });
}
