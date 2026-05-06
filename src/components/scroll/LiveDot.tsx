'use client';

interface LiveDotProps {
  className?: string;
  ariaLabel?: string;
}

export default function LiveDot({ className, ariaLabel }: LiveDotProps) {
  return (
    <span
      className={`live-dot${className ? ` ${className}` : ''}`}
      role={ariaLabel ? 'status' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    />
  );
}
