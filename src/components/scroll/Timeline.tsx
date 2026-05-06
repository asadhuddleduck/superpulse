'use client';

import type { ReactNode } from 'react';

interface TimelineProps {
  children: ReactNode;
  className?: string;
}

export default function Timeline({ children, className }: TimelineProps) {
  return (
    <ol
      className={`timeline${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        listStyle: 'none',
        margin: 0,
        padding: 0,
        paddingLeft: 28,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 7,
          top: 6,
          bottom: 6,
          width: 1,
          background: 'var(--border)',
        }}
      />
      {children}
    </ol>
  );
}
