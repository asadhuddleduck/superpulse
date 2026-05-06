'use client';

import type { ReactNode } from 'react';

type Accent = 'viridian' | 'chocolate';

interface ProofTileProps {
  quote: string;
  cite: string;
  logo?: ReactNode;
  accent?: Accent;
  className?: string;
}

export default function ProofTile({
  quote,
  cite,
  logo,
  accent = 'viridian',
  className,
}: ProofTileProps) {
  const borderColor =
    accent === 'chocolate' ? 'rgba(61, 40, 23, 0.5)' : 'var(--border)';
  const hoverBorder =
    accent === 'chocolate' ? 'rgba(61, 40, 23, 0.9)' : 'var(--border-bright)';

  return (
    <div
      className={`proof-tile${className ? ` ${className}` : ''}`}
      style={{
        background: 'var(--gradient-card)',
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: 24,
        transition: 'border-color 300ms var(--ease-premium)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = hoverBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
      }}
    >
      {logo && (
        <div style={{ marginBottom: 16, opacity: 0.85 }}>
          {logo}
        </div>
      )}
      <blockquote
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.55,
          color: 'var(--text-primary)',
          fontStyle: 'italic',
          fontWeight: 500,
        }}
      >
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {cite}
      </div>
    </div>
  );
}
