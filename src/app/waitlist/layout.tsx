import type { Metadata, Viewport } from "next";
import { Lato } from "next/font/google";
import "./waitlist.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "SuperPulse — Invitation-only waitlist",
  description:
    "Join the private SuperPulse waitlist. Smart post boosting for local chains.",
  robots: { index: false, follow: false },
};

export default function WaitlistLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${lato.variable} waitlist-root`}>{children}</div>;
}
