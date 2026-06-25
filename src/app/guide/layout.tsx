import type { Metadata } from "next";
import Link from "next/link";

// Public help/tutorial site. Two tracks: /guide (business owners / clients) and
// /guide/team (internal Team Huddle Duck operators). Sendable links, so it must
// be reachable without a login — but kept out of search indexes (the team track
// documents internal operations). Whitelisted past the beta gate in middleware.
export const metadata: Metadata = {
  title: "SuperPulse Guides",
  description: "How to use SuperPulse.",
  robots: { index: false, follow: false },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/guide" className="flex items-center gap-2 font-bold tracking-tight text-white">
            <span aria-hidden className="text-[#F7CE46]">⚡</span>
            SuperPulse
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 font-medium">Guides</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/guide"
              className="rounded-full px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              For owners
            </Link>
            <Link
              href="/guide/team"
              className="rounded-full px-3 py-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
            >
              For the team
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">{children}</main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-zinc-600">
          SuperPulse. Questions? Reply to any email from us and a human will get back to you.
        </div>
      </footer>
    </div>
  );
}
