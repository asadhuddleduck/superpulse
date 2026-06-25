"use client";

import { useState } from "react";

export default function CopyField({ value, compact }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`flex-1 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs text-zinc-300 outline-none ${
          compact ? "" : "font-mono"
        }`}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable as a fallback */
          }
        }}
        className="shrink-0 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
