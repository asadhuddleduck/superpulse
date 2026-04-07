"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface BoostSettings {
  daily_budget: number;
  target_radius: number;
  auto_boost: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BoostSettings>({
    daily_budget: 5.0,
    target_radius: 5,
    auto_boost: true,
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
            daily_budget: data.daily_budget ?? 5.0,
            target_radius: data.target_radius ?? 5,
            auto_boost: data.auto_boost ?? true,
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
      setMessage({ type: "error", text: "Network error — please try again" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
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
          <h2 className="text-3xl font-bold text-white">Boost Settings</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg border border-zinc-800 bg-zinc-900/50 animate-pulse"
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
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
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
        <h2 className="text-3xl font-bold text-white">Boost Settings</h2>
        <p className="text-zinc-500 mt-1">
          Configure how SuperPulse boosts your posts
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-lg space-y-6">
        {/* Daily Budget */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <label
            htmlFor="daily_budget"
            className="block text-sm font-medium text-zinc-300"
          >
            Daily Budget Cap
          </label>
          <p className="text-xs text-zinc-500 mt-1">
            Maximum amount to spend per day across all boosted posts
          </p>
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
              £
            </span>
            <input
              id="daily_budget"
              type="number"
              min="1"
              max="1000"
              step="0.50"
              value={settings.daily_budget}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  daily_budget: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 pl-7 pr-4 py-2.5 text-white text-sm focus:border-[#1EBA8F] focus:outline-none focus:ring-1 focus:ring-[#1EBA8F] transition-colors"
            />
          </div>
        </div>

        {/* Target Radius */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <label
            htmlFor="target_radius"
            className="block text-sm font-medium text-zinc-300"
          >
            Target Radius
          </label>
          <p className="text-xs text-zinc-500 mt-1">
            How far from your location to target (in miles)
          </p>
          <div className="mt-3 relative">
            <input
              id="target_radius"
              type="number"
              min="1"
              max="50"
              step="1"
              value={settings.target_radius}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  target_radius: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white text-sm focus:border-[#1EBA8F] focus:outline-none focus:ring-1 focus:ring-[#1EBA8F] transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
              miles
            </span>
          </div>
        </div>

        {/* Auto-Boost Toggle */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-300">Auto-Boost</p>
              <p className="text-xs text-zinc-500 mt-1">
                Automatically boost new posts that score above the threshold
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.auto_boost}
              onClick={() =>
                setSettings((s) => ({ ...s, auto_boost: !s.auto_boost }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1EBA8F] focus:ring-offset-2 focus:ring-offset-black ${
                settings.auto_boost ? "bg-[#1EBA8F]" : "bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition duration-200 ease-in-out ${
                  settings.auto_boost ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "bg-[#1EBA8F]/10 text-[#1EBA8F] border border-[#1EBA8F]/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#1EBA8F] px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-[#1EBA8F]/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#1EBA8F]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </>
  );
}
