'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

interface MaskedRevealProps {
  children: ReactNode;
  direction?: Direction;
  duration?: number;
  delay?: number;
  threshold?: number;
  className?: string;
  ariaLabel?: string;
}

function offsetForDirection(direction: Direction): string {
  switch (direction) {
    case 'up':
      return 'translateY(100%)';
    case 'down':
      return 'translateY(-100%)';
    case 'left':
      return 'translateX(100%)';
    case 'right':
      return 'translateX(-100%)';
  }
}

export default function MaskedReveal({
  children,
  direction = 'up',
  duration = 700,
  delay = 0,
  threshold = 0.4,
  className,
  ariaLabel,
}: MaskedRevealProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const innerStyle: CSSProperties = reduced
    ? { transform: 'none', opacity: 1 }
    : {
        transform: visible ? 'translate(0, 0)' : offsetForDirection(direction),
        opacity: visible ? 1 : 0,
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      };

  return (
    <span
      ref={ref}
      className={`masked-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      <span className="masked-reveal-inner" style={innerStyle} aria-hidden={ariaLabel ? 'true' : undefined}>
        {children}
      </span>
    </span>
  );
}
