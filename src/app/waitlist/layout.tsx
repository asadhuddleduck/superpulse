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
  title: "SuperPulse. Keep posting like you do, we turn it into locals walking in.",
  description:
    "You post on Instagram like normal. We turn the right posts into local ads that find people on your doorstep. For restaurants, barbers, dentists, clinics, gyms and any local business that runs on locals knowing you exist.",
  robots: { index: false, follow: false },
};

export default function WaitlistLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className={`${lato.variable} waitlist-root`}>{children}</div>;
}
