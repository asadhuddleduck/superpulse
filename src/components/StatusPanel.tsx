"use client";

import { useEffect, useState } from "react";

type Health = "green" | "yellow" | "red";

interface StatusPayload {
  scanLastRun: string | null;
  postsDetected: number;
  postsBoosted: number;
  campaignsLive: number;
  campaignsPaused: number;
  spendToDate: number;
  profileVisits: number;
  impressions: number;
  lastError: { endpoint: string; error: string; at: string } | null;
  health: Health;
  provisioning?: {
    state: string | null;
    locationsTotal: number;
    adsetsCreated: number;
    adsActive: number;
    adsTotal: number;
  } | null;
  recentActivity: Array<{
    eventType: string;
    message: string;
    createdAt: string;
  }>;
}

const POLL_INTERVAL_MS = 30_000;

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function HealthDot({ health }: { health: Health }) {
  const color =
    health === "green"
      ? "bg-[#1EBA8F]"
      : health === "yellow"
        ? "bg-[#F7CE46]"
        : "bg-red-500";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} ring-2 ring-current/20`}
      aria-label={`status ${health}`}
    />
  );
}

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    scan_completed: "Scan",
    boost_created: "Boost queued",
    boost_activated: "Boost live",
    review_failed: "Review failed",
    spend_threshold: "Spend alert",
    error: "Error",
    onboarding_complete: "Connected",
    subscription_changed: "Billing",
  };
  return map[eventType] ?? eventType;
}

export default function StatusPanel() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as StatusPayload;
        if (!cancelled) setData(json);
      } catch {
        // Silent — next tick will retry.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading || !data) {
    return (
      <section className="mb-10">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <p className="text-sm text-zinc-500">Loading status…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10 space-y-4">
      {/* Provisioning banner — honest "X/N ready" while the engine builds. */}
      {data.provisioning && data.provisioning.state && data.provisioning.state !== "active" ? (
        <ProvisioningBanner p={data.provisioning} />
      ) : null}

      {/* Hero strip */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2 mb-5">
          <HealthDot health={data.health} />
          <p className="text-sm text-zinc-300">
            Last scan: <span className="text-white">{formatRelative(data.scanLastRun)}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Posts detected" value={formatNumber(data.postsDetected)} />
          <Stat label="Posts boosted" value={formatNumber(data.postsBoosted)} />
          <Stat label="Campaigns live" value={formatNumber(data.campaignsLive)} />
          <Stat label="Spend this month" value={`£${data.spendToDate.toFixed(2)}`} />
        </div>
        {data.lastError && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 break-all">
            <span className="font-semibold">Recent error:</span> {data.lastError.error}{" "}
            <span className="text-red-400/60">({formatRelative(data.lastError.at)})</span>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent activity</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No activity yet. The first scan runs every 2 hours — sit tight.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.recentActivity.map((event, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 text-zinc-500 tabular-nums w-20">
                  {formatRelative(event.createdAt)}
                </span>
                <span className="shrink-0 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 w-28">
                  {eventLabel(event.eventType)}
                </span>
                <span className="text-zinc-200 flex-1 min-w-0 break-words">{event.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProvisioningBanner({
  p,
}: {
  p: { state: string | null; locationsTotal: number; adsetsCreated: number; adsActive: number; adsTotal: number };
}) {
  let message: string;
  let tone = "border-viridian/30 bg-viridian/5 text-viridian";
  if (p.state === "provision_failed") {
    message = "We hit a snag setting up your locations. Our team has been alerted.";
    tone = "border-red-500/30 bg-red-500/5 text-red-300";
  } else if (p.state === "provisioned") {
    if (p.adsTotal > 0 && p.adsActive < p.adsTotal) {
      message = `All ${p.locationsTotal} locations set up. Final checks before your first boosts go live.`;
    } else {
      message = `Live across ${p.locationsTotal} location${p.locationsTotal === 1 ? "" : "s"}.`;
    }
  } else {
    message = `Setting up your ${p.locationsTotal} location${p.locationsTotal === 1 ? "" : "s"}… ${p.adsetsCreated}/${p.locationsTotal} ready`;
  }
  const fillPct =
    p.locationsTotal > 0 ? Math.min(100, Math.round((p.adsetsCreated / p.locationsTotal) * 100)) : 0;
  return (
    <div className={`rounded-xl border p-4 text-sm ${tone}`}>
      <p className="font-medium">{message}</p>
      {p.state === "provisioning" ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-viridian transition-all" style={{ width: `${fillPct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}
