type StepKey = "connect" | "account" | "locations" | "budget";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "account", label: "Account" },
  { key: "locations", label: "Locations" },
  { key: "budget", label: "Budget" },
];

/**
 * Compact 4-step progress for the onboarding flow. Reads clean at 390px:
 * a "Step N of 4 · Label" line above a segmented bar (done + current = viridian).
 * select-page / select-ad-account both map to the "account" step.
 */
export function OnboardingProgress({ step }: { step: StepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[currentIndex] ?? STEPS[0];

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-wider text-mist">
          Step {currentIndex + 1} of {STEPS.length}
        </span>
        <span className="text-sm font-medium text-white">{current.label}</span>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={[
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= currentIndex ? "bg-viridian" : "bg-slate",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

export default OnboardingProgress;
