'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Lenis from 'lenis';

interface LenisScrollState {
  scrollY: number;
  progress: number;
  velocity: number;
}

const LenisContext = createContext<LenisScrollState>({
  scrollY: 0,
  progress: 0,
  velocity: 0,
});

export function useLenisScroll() {
  return useContext(LenisContext);
}

interface LenisProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export default function LenisProvider({ children, enabled }: LenisProviderProps) {
  const [scrollState, setScrollState] = useState<LenisScrollState>({
    scrollY: 0,
    progress: 0,
    velocity: 0,
  });
  const lenisRef = useRef<Lenis | null>(null);

  // Resolve enabled flag: prop > env var > default true
  const flagEnabled = (() => {
    if (typeof enabled === 'boolean') return enabled;
    const envVal = process.env.NEXT_PUBLIC_PROPOSAL_LENIS;
    if (envVal === undefined) return true;
    return envVal !== 'false';
  })();

  useEffect(() => {
    if (!flagEnabled) return;

    if (typeof window !== 'undefined') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: true,
    });

    lenisRef.current = lenis;

    const onScroll = ({
      scroll,
      progress,
      velocity,
    }: {
      scroll: number;
      progress: number;
      velocity: number;
    }) => {
      setScrollState({ scrollY: scroll, progress, velocity });
    };

    lenis.on('scroll', onScroll);

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [flagEnabled]);

  return (
    <LenisContext.Provider value={scrollState}>{children}</LenisContext.Provider>
  );
}
