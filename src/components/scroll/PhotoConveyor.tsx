'use client';

import Image from 'next/image';

// Always-on left-scrolling marquee of brand photos. Pure CSS keyframe
// translateX, no JS. Photos render at natural aspect ratio so nothing
// is cropped. The track is duplicated so the loop is seamless.

type Photo = { src: string; alt: string };

const PHOTOS: Photo[] = [
  { src: '/heavenly-desserts/hd-1-flatbreads.png', alt: 'Flatbreads' },
  { src: '/heavenly-desserts/hd-2-mango-chilli.png', alt: 'Mango chilli' },
  { src: '/heavenly-desserts/hd-3-berry-tart.png', alt: 'Berry tart' },
  { src: '/heavenly-desserts/hd-4-tokyo.png', alt: 'Tokyo storefront' },
  { src: '/heavenly-desserts/hd-5-pancakes.png', alt: 'Strawberry pancakes' },
  { src: '/heavenly-desserts/hd-6-violet-cake.png', alt: 'Violet cake' },
];

// Uniform 4:5 portrait tiles (Instagram portrait standard). Source
// images are cropped to fit via object-fit: cover, so every tile is
// the same shape and the conveyor reads as one consistent rhythm.
const RATIO = '4 / 5';

export default function PhotoConveyor({ tileHeight = 200, gap = 12, durationS = 32 }: { tileHeight?: number; gap?: number; durationS?: number }) {
  const tiles = [...PHOTOS, ...PHOTOS];
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
      }}
    >
      <div
        className="proposal-conveyor-track"
        style={{
          display: 'flex',
          gap,
          width: 'max-content',
          animationDuration: `${durationS}s`,
        }}
      >
        {tiles.map((p, i) => (
          <div
            key={`${p.src}-${i}`}
            style={{
              height: tileHeight,
              aspectRatio: RATIO,
              borderRadius: 10,
              overflow: 'hidden',
              position: 'relative',
              flex: '0 0 auto',
            }}
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              sizes={`${Math.round(tileHeight * 0.8)}px`}
              style={{ objectFit: 'cover', objectPosition: 'center' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
