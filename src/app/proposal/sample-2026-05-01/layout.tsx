import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../proposal.css';

export const metadata: Metadata = {
  title: 'Sample Proposal × Superpulse',
  description:
    'Anonymised sample of a Superpulse proposal. Client identity redacted.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

// Anonymised mirror of the live HD proposal — same shape, same numbers,
// client name replaced with red NDA tape, photos blurred, logos removed.
export default function SampleProposalLayout({ children }: { children: ReactNode }) {
  return <div className="proposal-root">{children}</div>;
}
