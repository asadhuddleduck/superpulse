"use client";

import { useState } from "react";

type LinkType = "paid" | "prepaid" | "magic";

const TYPES: { key: LinkType; label: string; blurb: string }[] = [
  { key: "paid", label: "Pay to join", blurb: "Client checks out (£300/mo) before they get access." },
  { key: "prepaid", label: "Prepaid / comp", blurb: "Granted access free, no Stripe charge. Straight to setup." },
  { key: "magic", label: "Resume / magic", blurb: "Re-invite an existing client to finish or reconnect." },
];

const inputCls =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm outline-none focus:border-viridian";

export default function LinkForm() {
  const [type, setType] = useState<LinkType>("paid");

  return (
    <form action="/admin/api/links" method="post" className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Link type</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.key}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${
                type === t.key ? "border-viridian bg-viridian/10" : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.key}
                checked={type === t.key}
                onChange={() => setType(t.key)}
                className="sr-only"
              />
              <div className="font-medium text-white">{t.label}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{t.blurb}</div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Label (internal)</label>
          <input name="label" placeholder="e.g. Sparkhill cluster" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Client email {type === "magic" ? "" : "(optional, lets you email the link)"}
          </label>
          <input name="email" type="email" placeholder="owner@business.com" className={inputCls} />
        </div>

        {type === "paid" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Stripe coupon (optional)</label>
            <input name="coupon" placeholder="FIRSTMONTHFREE" className={inputCls} />
          </div>
        )}

        {type === "magic" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Target tenant ID</label>
            <input name="targetTenantId" placeholder="t_17841..." className={inputCls} required />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Max uses</label>
          <input name="maxUses" type="number" min={1} defaultValue={1} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Expires in (days, 0 = never)</label>
          <input name="expiresDays" type="number" min={0} defaultValue={0} className={inputCls} />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-black hover:bg-viridian/90"
      >
        Create link
      </button>
    </form>
  );
}
