'use client';

import { useEffect, useRef, useState } from 'react';

type CounterFormat = 'default' | 'comma' | 'currency';

interface AnimatedCounterProps {
  end: number;
  prefix?: string;
  suffix?: string;
  format?: CounterFormat;
  duration?: number;
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

export default function AnimatedCounter({
  end,
  prefix = '',
  suffix = '',
  format = 'default',
  duration = 1600,
  threshold = 0.3,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setValue(end);
        hasAnimated.current = true;
        return;
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        const startTime = performance.now();

        function tick(now: number) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(eased * end);
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration, threshold]);

  return (
    <span ref={ref} className={`animated-counter${className ? ` ${className}` : ''}`}>
      {prefix}
      {formatValue(value, format)}
      {suffix}
    </span>
  );
}
