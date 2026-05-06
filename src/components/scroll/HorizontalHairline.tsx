'use client';

interface HorizontalHairlineProps {
  className?: string;
}

export default function HorizontalHairline({ className }: HorizontalHairlineProps) {
  return (
    <span
      className={`horizontal-hairline${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}
