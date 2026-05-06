'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StrikethroughNumberProps {
  children: ReactNode;
  threshold?: number;
  className?: string;
}

export default function StrikethroughNumber({
  children,
  threshold = 0.5,
  className,
}: StrikethroughNumberProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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

  return (
    <span
      ref={ref}
      className={`strikethrough-number${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
    >
      <span>{children}</span>
      <span className="strikethrough-number-line" aria-hidden="true" />
    </span>
  );
}
