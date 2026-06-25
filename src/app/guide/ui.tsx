// Shared building blocks for the guide pages. All server components, no client
// JS (FAQ uses native <details>). Brand: black bg, gold #F7CE46 + viridian
// #1EBA8F accents, Geist (inherited from the root layout).
import type { ReactNode } from "react";

export function Hero({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div className="mb-12">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#F7CE46]">{kicker}</p>
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">{sub}</p>
    </div>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-20 border-t border-zinc-900 pt-10 first:mt-0 first:border-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

export function Step({ n, title, children, see }: { n: number; title: string; children: ReactNode; see?: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F7CE46]/30 bg-[#F7CE46]/10 text-sm font-bold text-[#F7CE46]">
        {n}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="mt-1 space-y-2 leading-relaxed text-zinc-300">{children}</div>
        {see && (
          <p className="mt-2 text-sm text-zinc-500">
            <span className="text-zinc-400">What you&rsquo;ll see:</span> {see}
          </p>
        )}
      </div>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="space-y-7">{children}</div>;
}

export function Callout({ children, tone = "viridian" }: { children: ReactNode; tone?: "viridian" | "gold" }) {
  const ring = tone === "gold" ? "border-[#F7CE46]/30 bg-[#F7CE46]/5" : "border-[#1EBA8F]/30 bg-[#1EBA8F]/5";
  return <div className={`rounded-xl border ${ring} px-4 py-3 text-sm leading-relaxed text-zinc-300`}>{children}</div>;
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900">
      {items.map((item, i) => (
        <details key={i} className="group px-4 [&_summary]:cursor-pointer">
          <summary className="flex list-none items-center justify-between gap-4 py-4 font-medium text-white marker:hidden">
            {item.q}
            <span aria-hidden className="text-zinc-600 transition group-open:rotate-45">+</span>
          </summary>
          <div className="pb-4 leading-relaxed text-zinc-400">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
