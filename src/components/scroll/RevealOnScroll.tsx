'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

interface RevealOnScrollProps {
  children: ReactNode;
  threshold?: number;
  delayMs?: number;
  repeat?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
}

export default function RevealOnScroll({
  children,
  threshold = 0.3,
  delayMs = 0,
  repeat = false,
  as = 'div',
  className,
  style,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setVisible(true);
        return;
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        } else if (repeat) {
          setVisible(false);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, repeat]);

  const Tag = as as keyof React.JSX.IntrinsicElements;
  const mergedStyle: CSSProperties = {
    transitionDelay: delayMs ? `${delayMs}ms` : undefined,
    ...style,
  };

  // Cast through a permissive shape so we can pass `ref` to any tag.
  const Element = Tag as unknown as React.ComponentType<{
    ref: React.Ref<HTMLElement>;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
  }>;

  return (
    <Element
      ref={ref}
      className={`reveal-on-scroll${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={mergedStyle}
    >
      {children}
    </Element>
  );
}
