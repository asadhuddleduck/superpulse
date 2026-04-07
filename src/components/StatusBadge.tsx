type Status = "ACTIVE" | "PAUSED" | "ENDED" | "NOT_BOOSTED";

const statusStyles: Record<Status, string> = {
  ACTIVE: "bg-[#1EBA8F]/15 text-[#1EBA8F] border-[#1EBA8F]/30",
  PAUSED: "bg-[#F7CE46]/15 text-[#F7CE46] border-[#F7CE46]/30",
  ENDED: "bg-zinc-600/15 text-zinc-400 border-zinc-600/30",
  NOT_BOOSTED: "bg-transparent text-zinc-500 border-zinc-700",
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
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#1EBA8F] animate-pulse" />
      )}
      {statusLabels[status]}
    </span>
  );
}
