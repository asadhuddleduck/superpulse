// Shared presentational bits for the HQ console (server components, no JS).

export function StageBadge({ stage, stepIndex }: { stage: string; stepIndex: number }) {
  let cls = "bg-zinc-800 text-zinc-300";
  if (stepIndex === -1) cls = "bg-red-950 text-red-300 border border-red-900/50";
  else if (stage === "Paused") cls = "bg-sandstorm/15 text-sandstorm border border-sandstorm/30";
  else if (stepIndex >= 6) cls = "bg-viridian/15 text-viridian border border-viridian/30";
  else if (stage.includes("payment") || stage.includes("Payment") || stage === "Past due")
    cls = "bg-red-950/60 text-red-300 border border-red-900/40";
  else cls = "bg-blue-950/50 text-blue-300 border border-blue-900/40";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {stage}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "amber" | "red" }) {
  const tones = {
    zinc: "bg-zinc-800 text-zinc-300",
    green: "bg-viridian/15 text-viridian",
    amber: "bg-sandstorm/15 text-sandstorm",
    red: "bg-red-950/60 text-red-300",
  };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}
