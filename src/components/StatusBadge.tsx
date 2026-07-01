type Status = "ACTIVE" | "PAUSED" | "ENDED" | "NOT_BOOSTED";

const statusStyles: Record<Status, string> = {
  ACTIVE: "bg-viridian/15 text-viridian border-viridian/30",
  PAUSED: "bg-sandstorm/15 text-sandstorm border-sandstorm/30",
  ENDED: "bg-slate/40 text-mist border-slate",
  NOT_BOOSTED: "bg-transparent text-mist border-slate",
};

const statusLabels: Record<Status, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  ENDED: "Ended",
  NOT_BOOSTED: "Not Boosted",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {status === "ACTIVE" && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-viridian animate-pulse" />
      )}
      {statusLabels[status]}
    </span>
  );
}
