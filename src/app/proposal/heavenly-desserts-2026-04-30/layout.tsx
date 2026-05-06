import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import SectionVisibilityObserver from './SectionVisibilityObserver';
import '../proposal.css';

export const metadata: Metadata = {
  title: 'Heavenly Desserts × Superpulse',
  description:
    'For the marketing director of a 62-site UK food chain. Switches on in minutes, not weeks.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

// Slide-by-slide proposal format uses native CSS scroll-snap.
// Lenis disabled here, its inertial scroll fights scroll-snap-stop:always.
export default function ProposalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="proposal-root">
      <SectionVisibilityObserver />
      {children}
    </div>
  );
}
