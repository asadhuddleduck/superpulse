import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './styles.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

const TITLE = 'The Qureskincare Playbook';
const DESCRIPTION =
  'Zero to fifty million, fact-checked and packaged for your brand. Tap to open on your phone.';
const OG_IMAGE = 'https://superpulse.io/proposal-og/sohail-hasani-2026-05-13.png';
const PROPOSAL_URL = 'https://superpulse.io/proposal/sohail-hasani-2026-05-13';

export const metadata: Metadata = {
  metadataBase: new URL('https://superpulse.io'),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PROPOSAL_URL,
    siteName: 'Superpulse',
    type: 'article',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'The Qureskincare Playbook — prepared for Sohail Hasani',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function ProposalLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.variable} sohail-proposal-root`}>{children}</div>;
}
