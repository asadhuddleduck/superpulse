import Link from "next/link";

// Minimal, unauthenticated shell for the HQ login + password-recovery screens.
// Deliberately NOT the console layout (no sidebar, no requireHqUser).
export default function HqAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-foreground flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/admin" className="block text-center text-2xl font-bold tracking-tight mb-8">
          <span className="text-viridian">Super</span>
          <span className="text-sandstorm">Pulse</span>
          <span className="text-zinc-500 font-medium"> HQ</span>
        </Link>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
          {children}
        </div>
        <p className="text-center text-xs text-zinc-600 mt-6">
          Operator console · authorised team only
        </p>
      </div>
    </div>
  );
}
