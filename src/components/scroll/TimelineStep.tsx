'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface TimelineStepProps {
  children: ReactNode;
  delayMs?: number;
  threshold?: number;
  className?: string;
}

export default function TimelineStep({
  children,
  delayMs = 0,
  threshold = 0.3,
  className,
}: TimelineStepProps) {
  const ref = useRef<HTMLLIElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setActive(true);
        return;
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.setTimeout(() => setActive(true), delayMs);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs, threshold]);

  return (
    <li
      ref={ref}
      className={`timeline-step${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        paddingBottom: 24,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 600ms var(--ease-premium), transform 600ms var(--ease-premium)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -28,
          top: 4,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: active ? 'var(--viridian)' : 'transparent',
          border: '2px solid var(--viridian)',
          boxShadow: active ? '0 0 0 4px rgba(30, 186, 143, 0.18)' : 'none',
          transition: 'background 400ms var(--ease-premium), box-shadow 400ms var(--ease-premium)',
        }}
      />
      {children}
    </li>
  );
}
