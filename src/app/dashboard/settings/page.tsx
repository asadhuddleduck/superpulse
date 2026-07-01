"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface BoostSettings {
  dailyBudgetCap: number;
  targetRadiusMiles: number;
  autoBoostEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BoostSettings>({
    dailyBudgetCap: 5.0,
    targetRadiusMiles: 5,
    autoBoostEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/boost/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings({
            dailyBudgetCap: data.dailyBudgetCap ?? 5.0,
            targetRadiusMiles: data.targetRadiusMiles ?? 5,
            autoBoostEnabled: data.autoBoostEnabled ?? true,
          });
        }
      } catch {
        // Use defaults if API not available yet
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/boost/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Settings saved" });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: data.error || "Failed to save settings",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Network error, please try again" });
    } finally {
      setSaving(false);
    }
  }

  const backLink = (
    <Link
      href="/dashboard"
      className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-mist transition-colors hover:text-white"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 19.5 8.25 12l7.5-7.5"
        />
      </svg>
      Back to Dashboard
    </Link>
  );

  if (loading) {
    return (
      <>
        <div className="mb-8">
          {backLink}
          <PageHeading title="Boost Settings" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-slate bg-graphite/50"
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        {backLink}
        <PageHeading
          title="Boost Settings"
          subtitle="Configure how SuperPulse boosts your posts"
        />
      </div>

      <form onSubmit={handleSave} className="max-w-lg space-y-6">
        {/* Daily Budget */}
        <Card>
          <label
            htmlFor="daily_budget"
            className="block text-sm font-medium text-white"
          >
            Daily Budget Cap
          </label>
          <p className="mt-1 text-xs text-mist">
            Maximum amount to spend per day across all boosted posts
          </p>
          <div className="relative mt-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
              £
            </span>
            <input
              id="daily_budget"
              type="number"
              min="1"
              max="1000"
              step="0.50"
              value={settings.dailyBudgetCap}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  dailyBudgetCap: parseFloat(e.target.value) || 0,
                }))
              }
              className="min-h-11 w-full rounded-lg border border-slate bg-void pl-7 pr-4 py-2.5 text-sm text-white transition-colors focus:border-viridian focus:outline-none focus:ring-1 focus:ring-viridian"
            />
          </div>
        </Card>

        {/* Target Radius */}
        <Card>
          <label
            htmlFor="target_radius"
            className="block text-sm font-medium text-white"
          >
            Target Radius
          </label>
          <p className="mt-1 text-xs text-mist">
            How far from your location to target (in miles)
          </p>
          <div className="relative mt-3">
            <input
              id="target_radius"
              type="number"
              min="1"
              max="50"
              step="1"
              value={settings.targetRadiusMiles}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  targetRadiusMiles: parseInt(e.target.value) || 0,
                }))
              }
              className="min-h-11 w-full rounded-lg border border-slate bg-void px-4 py-2.5 text-sm text-white transition-colors focus:border-viridian focus:outline-none focus:ring-1 focus:ring-viridian"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mist">
              miles
            </span>
          </div>
        </Card>

        {/* Smart Boost Toggle */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Smart Boost</p>
              <p className="mt-1 text-xs text-mist">
                Recommend and boost new posts that score above the threshold
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoBoostEnabled}
              onClick={() =>
                setSettings((s) => ({ ...s, autoBoostEnabled: !s.autoBoostEnabled }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-viridian focus:ring-offset-2 focus:ring-offset-void ${
                settings.autoBoostEnabled ? "bg-viridian" : "bg-mist/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200 ease-in-out ${
                  settings.autoBoostEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Status message */}
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-viridian/10 text-viridian border border-viridian/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save button */}
        <Button type="submit" disabled={saving} loading={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </>
  );
}
