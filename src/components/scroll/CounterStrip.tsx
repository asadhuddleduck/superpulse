'use client';

import { Children, type ReactNode } from 'react';
import RevealOnScroll from './RevealOnScroll';

interface CounterStripProps {
  children: ReactNode;
  staggerMs?: number;
  className?: string;
}

export default function CounterStrip({
  children,
  staggerMs = 100,
  className,
}: CounterStripProps) {
  const items = Children.toArray(children);
  return (
    <div className={`counter-strip${className ? ` ${className}` : ''}`}>
      {items.map((child, i) => (
        <RevealOnScroll
          key={i}
          delayMs={i * staggerMs}
          className="counter-strip-item"
        >
          {child}
        </RevealOnScroll>
      ))}
    </div>
  );
}
