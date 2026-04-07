interface SummaryCardProps {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  prefix?: string;
}

function TrendArrow({ trend }: { trend: "up" | "down" | "neutral" }) {
  if (trend === "up") {
    return (
      <svg
        className="h-4 w-4 text-[#1EBA8F]"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg
        className="h-4 w-4 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
      </svg>
    );
  }
  return (
    <svg
      className="h-4 w-4 text-zinc-500"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  );
}

export default function SummaryCard({ label, value, trend, prefix }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-3xl font-bold text-white">
          {prefix && <span className="text-zinc-400">{prefix}</span>}
          {value}
        </p>
        {trend && <TrendArrow trend={trend} />}
      </div>
    </div>
  );
}
