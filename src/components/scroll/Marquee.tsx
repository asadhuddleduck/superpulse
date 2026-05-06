'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
}

export default function Marquee({
  children,
  speed = 60,
  direction = 'left',
  className,
}: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    if (!track) return;

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth === 0) return;

    let last = performance.now();
    function step(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      const delta = speed * dt * (direction === 'left' ? -1 : 1);
      offsetRef.current += delta;
      if (direction === 'left' && offsetRef.current <= -halfWidth) {
        offsetRef.current += halfWidth;
      } else if (direction === 'right' && offsetRef.current >= 0) {
        offsetRef.current -= halfWidth;
      }
      if (track) {
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, direction, reduced]);

  return (
    <div className={`marquee${className ? ` ${className}` : ''}`}>
      <div ref={trackRef} className="marquee-track" aria-hidden={false}>
        {children}
        {!reduced && <div aria-hidden="true" style={{ display: 'flex', gap: 'inherit' }}>{children}</div>}
      </div>
    </div>
  );
}
