import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

type MaxWidth = "xl" | "2xl" | "3xl";

const widths: Record<MaxWidth, string> = {
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

type OnboardingShellProps = {
  children: ReactNode;
  /** Right-hand header slot (e.g. a sign-out or "Stuck?" link) */
  headerRight?: ReactNode;
  /** Content column width — header aligns to the same width */
  maxWidth?: MaxWidth;
  /** Vertically centre the content column (short single-card screens) */
  center?: boolean;
  className?: string;
};

/**
 * Shared frame for the self-serve flow (gate / onboarding / pricing / support).
 * One header, one content column width (header + main aligned — fixes the old
 * max-w-5xl header vs max-w-2xl main mismatch), one vertical rhythm.
 */
export function OnboardingShell({
  children,
  headerRight,
  maxWidth = "xl",
  center = false,
  className = "",
}: OnboardingShellProps) {
  const width = widths[maxWidth];
  return (
    <div className="flex min-h-screen flex-col bg-void text-white">
      <header className="border-b border-slate">
        <div className={`mx-auto flex w-full ${width} items-center justify-between gap-3 px-6 py-4`}>
          <Wordmark href="/" />
          {headerRight ? <div className="flex items-center gap-3 text-sm">{headerRight}</div> : null}
        </div>
      </header>
      <main
        className={[
          `mx-auto flex w-full ${width} flex-1 flex-col px-6 py-10 sm:py-14`,
          center ? "justify-center" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </main>
    </div>
  );
}

export default OnboardingShell;
