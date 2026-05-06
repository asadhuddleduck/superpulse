'use client';

import { useEffect, useState } from 'react';

// Always-on counter that ticks up forever from a baseline. No
// IntersectionObserver, no scroll trigger — just a forever-incrementing
// number to communicate "this is happening every minute, on autopilot."

interface CounterTickUpProps {
  start?: number;
  incrementMin?: number;
  incrementMax?: number;
  intervalMs?: number;
  prefix?: string;
  suffix?: string;
}

export default function CounterTickUp({
  start = 12_847,
  incrementMin = 1,
  incrementMax = 4,
  intervalMs = 700,
  prefix = '',
  suffix = '',
}: CounterTickUpProps) {
  const [value, setValue] = useState(start);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      return;
    }

    const tick = () => {
      const inc =
        Math.floor(Math.random() * (incrementMax - incrementMin + 1)) +
        incrementMin;
      setValue((v) => v + inc);
    };

    const handle = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(handle);
  }, [incrementMin, incrementMax, intervalMs]);

  return (
    <span
      style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}
      aria-live={reduced ? 'off' : 'polite'}
    >
      {prefix}
      {value.toLocaleString('en-GB')}
      {suffix}
    </span>
  );
}
