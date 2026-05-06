'use client';

import {
  createContext,
  useContext,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

/**
 * ScrollPinnedSection — sticky inner content that exposes a 0→1 progress
 * value as the user scrolls past it.
 *
 * Outer wrapper takes (pinHeight + 1) * 100vh of height. Inner content is
 * position: sticky and stays glued to the top of the viewport while the
 * outer container scrolls past. Children receive `progress` either via the
 * render-prop `children` form OR via the `useScrollProgress` hook (any
 * descendant component can subscribe).
 *
 * Used in §2 (split-screen agitate, ~1.5 vh), §4 (3-step phone explainer,
 * default 2.5 — gated on qa-mobile verification; design v1.2 says drop to
 * 1.8 if jank), and §8 (3-tab boost comparison, ~3 vh).
 *
 * Honours fast flings: never traps scroll. The animation simply maps 1:1 to
 * scroll position, so a hard fling fast-forwards the internal animation to
 * its end-state rather than fighting velocity.
 */

type ProgressCtx = {
  progress: MotionValue<number>;
};
const Ctx = createContext<ProgressCtx | null>(null);

export function useScrollProgress(): MotionValue<number> {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useScrollProgress must be used inside <ScrollPinnedSection>.');
  }
  return v.progress;
}

type RenderProp = (progress: MotionValue<number>) => ReactNode;

export type ScrollPinnedSectionProps = {
  /** How many extra viewport-heights of scroll the section pins for. */
  pinHeight?: number;
  /** Children — either a render-prop function or normal nodes. */
  children: ReactNode | RenderProp;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  /** Optional id for anchor links. */
  id?: string;
};

export default function ScrollPinnedSection({
  pinHeight = 2.5,
  children,
  className,
  innerClassName,
  style,
  innerStyle,
  id,
}: ScrollPinnedSectionProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Map raw scrollYProgress (0 = wrapper enters top of viewport,
  // 1 = wrapper exits bottom) into a normalized 0→1 across the *pin* span
  // by clamping. We use `start start` -> `end end` so progress hits 1 only
  // when the wrapper has fully scrolled past.
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end end'],
  });
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const totalVh = pinHeight + 1;

  const renderChildren =
    typeof children === 'function' ? (children as RenderProp)(progress) : children;

  return (
    <Ctx.Provider value={{ progress }}>
      <div
        ref={wrapperRef}
        id={id}
        className={className}
        style={{
          position: 'relative',
          height: `${totalVh * 100}vh`,
          ...style,
        }}
      >
        <motion.div
          className={innerClassName}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'hidden',
            ...innerStyle,
          }}
        >
          {renderChildren}
        </motion.div>
      </div>
    </Ctx.Provider>
  );
}

/** Helper: derive a 0→1 sub-range from the parent progress (e.g. 0.33→0.66 = step 2). */
export function useStepProgress(start: number, end: number): MotionValue<number> {
  const parent = useScrollProgress();
  return useTransform(parent, [start, end], [0, 1], { clamp: true });
}
