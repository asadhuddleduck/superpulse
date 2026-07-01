import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Headlines + body (BRAND-KIT.md: Inter 400/500/700/800)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

// Data / metrics (BRAND-KIT.md: JetBrains Mono 400/500)
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SuperPulse | Smart Instagram Boosting",
  description:
    "SuperPulse helps local businesses boost their best Instagram posts to reach nearby audiences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-foreground">
        {children}
      </body>
    </html>
  );
}
