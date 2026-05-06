'use client';

import { useEffect, useState } from 'react';

type TileColor = 'viridian' | 'sandstorm' | 'white';

interface CascadeTile {
  label: string;
  color: TileColor;
}

interface SwitchOnCascadeProps {
  tiles?: CascadeTile[];
  cascadeMs?: number;
  loopIntervalMs?: number;
  className?: string;
}

const DEFAULT_TILES: CascadeTile[] = [
  { label: 'Switch on', color: 'viridian' },
  { label: 'First impression', color: 'sandstorm' },
  { label: 'Local sees it', color: 'white' },
];

// Always-on cascade. No IntersectionObserver needed: the parent slide
// is only ever rendered inside the proposal scroll container, and the
// loop is cheap (3 setTimeouts per 3.2s cycle). Trying to gate this on
// IO failed when the cascade element's IO root didn't match the custom
// scroll container, leaving tiles permanently dim.
export default function SwitchOnCascade({
  tiles = DEFAULT_TILES,
  cascadeMs = 800,
  loopIntervalMs = 3200,
  className,
}: SwitchOnCascadeProps) {
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedNow = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(reducedNow);
    if (reducedNow) {
      setActiveIdx(tiles.length - 1);
      return;
    }

    const perTileGap = cascadeMs / tiles.length;
    let timers: number[] = [];

    function fire() {
      timers.forEach(clearTimeout);
      timers = [];
      tiles.forEach((_, i) => {
        const t = window.setTimeout(() => setActiveIdx(i), i * perTileGap);
        timers.push(t);
      });
      const dimT = window.setTimeout(() => setActiveIdx(-1), cascadeMs + 1600);
      timers.push(dimT);
    }

    fire();
    const loop = window.setInterval(fire, loopIntervalMs);

    return () => {
      window.clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, [tiles, cascadeMs, loopIntervalMs, reduced]);

  return (
    <div
      className={`switch-on-cascade${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      {tiles.map((tile, i) => {
        const isActive = reduced ? true : i <= activeIdx;
        return (
          <span
            key={`${tile.label}-${i}`}
            className={`switch-on-tile color-${tile.color}${isActive ? ' is-active' : ''}`}
          >
            {tile.label}
          </span>
        );
      })}
    </div>
  );
}
