"use client";

// Client-side action bar for a client detail page. Each control is a real form
// POST to the lifecycle / impersonate routes; destructive ones confirm first.

function ActionForm({
  action,
  children,
  confirm,
  variant = "ghost",
}: {
  action: string;
  children: React.ReactNode;
  confirm?: string;
  variant?: "primary" | "ghost" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "bg-viridian text-black hover:bg-viridian/90"
      : variant === "danger"
        ? "border border-red-900/60 text-red-300 hover:bg-red-950/40"
        : "border border-zinc-800 text-zinc-300 hover:bg-zinc-900";
  return (
    <form
      method="post"
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${cls}`}>
        {children}
      </button>
    </form>
  );
}

export default function ClientActions({
  tenantId,
  hqPaused,
  comp,
  offboarded,
  canAdmin,
}: {
  tenantId: string;
  hqPaused: boolean;
  comp: boolean;
  offboarded: boolean;
  canAdmin: boolean;
}) {
  const base = `/admin/api/clients/${encodeURIComponent(tenantId)}`;
  return (
    <div className="flex flex-wrap gap-2">
      {!offboarded && (
        <ActionForm action={`/admin/api/impersonate/${encodeURIComponent(tenantId)}`} variant="primary">
          View as client
        </ActionForm>
      )}

      {!offboarded &&
        (hqPaused ? (
          <ActionForm action={`${base}/reactivate`}>Reactivate</ActionForm>
        ) : (
          <ActionForm action={`${base}/pause`} confirm="Pause this client? Their live ads will be paused.">
            Pause
          </ActionForm>
        ))}

      {!offboarded &&
        (comp ? (
          <ActionForm action={`${base}/uncomp`} confirm="Remove comped access? They'll need a paid subscription to stay live.">
            Remove comp
          </ActionForm>
        ) : (
          <ActionForm action={`${base}/comp`} confirm="Mark this client as comped (free access, no Stripe charge)?">
            Mark comped
          </ActionForm>
        ))}

      {canAdmin &&
        (offboarded ? (
          <ActionForm action={`${base}/reinstate`} confirm="Reinstate this client and restore access?">
            Reinstate
          </ActionForm>
        ) : (
          <ActionForm
            action={`${base}/offboard`}
            variant="danger"
            confirm="Offboard this client? This cancels their Stripe subscription, pauses all their ads, and revokes access. Campaigns are paused, never deleted."
          >
            Offboard
          </ActionForm>
        ))}
    </div>
  );
}
