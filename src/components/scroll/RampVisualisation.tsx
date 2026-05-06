'use client';

import { useEffect, useRef, useState } from 'react';

type CounterFormat = 'default' | 'comma' | 'currency';

interface RampVisualisationProps {
  target: number;
  prefix?: string;
  suffix?: string;
  format?: CounterFormat;
  rampMs?: number;
  idleIncrement?: number;
  idleIntervalMs?: number;
  threshold?: number;
  className?: string;
}

function formatValue(raw: number, format: CounterFormat): string {
  const rounded = Math.round(raw);
  switch (format) {
    case 'comma':
      return rounded.toLocaleString('en-GB');
    case 'currency':
      return rounded.toLocaleString('en-GB');
    case 'default':
    default:
      return rounded >= 1000 ? rounded.toLocaleString('en-GB') : String(rounded);
  }
}

export default function RampVisualisation({
  target,
  prefix = '',
  suffix = '',
  format = 'default',
  rampMs = 800,
  idleIncrement = 1,
  idleIntervalMs = 1000,
  threshold = 0.3,
  className,
}: RampVisualisationProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const phaseRef = useRef<'idle-pre' | 'ramping' | 'idle-post'>('idle-pre');
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let intervalId = 0;
    let cancelled = false;

    function startRamp() {
      if (startedRef.current) return;
      startedRef.current = true;

      if (reduced) {
        setValue(target);
        phaseRef.current = 'idle-post';
        intervalId = window.setInterval(() => {
          if (cancelled) return;
          setValue((v) => v + idleIncrement);
        }, idleIntervalMs);
        return;
      }

      phaseRef.current = 'ramping';
      const startTime = performance.now();

      function tick(now: number) {
        if (cancelled) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / rampMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(eased * target);
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          phaseRef.current = 'idle-post';
          intervalId = window.setInterval(() => {
            if (cancelled) return;
            setValue((v) => v + idleIncrement);
          }, idleIntervalMs);
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startRamp();
      },
      { threshold },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [target, rampMs, idleIncrement, idleIntervalMs, threshold]);

  return (
    <span ref={ref} className={`animated-counter${className ? ` ${className}` : ''}`}>
      {prefix}
      {formatValue(value, format)}
      {suffix}
    </span>
  );
}
