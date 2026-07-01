import { getImpersonation } from "@/lib/hq-auth";
import { getTenantById } from "@/lib/queries/tenants";

// Persistent banner shown across /dashboard + /onboarding while an operator is
// "viewing as" a client. Read-only — every mutating customer route is guarded
// by assertNotImpersonating(). The step links let the operator walk the client's
// onboarding screens as the client sees them.

const STEPS: { href: string; label: string }[] = [
  { href: "/onboarding/connect", label: "Connect" },
  { href: "/onboarding/select-page", label: "Page" },
  { href: "/onboarding/select-ad-account", label: "Ad account" },
  { href: "/onboarding/locations", label: "Locations" },
  { href: "/dashboard", label: "Dashboard" },
];

export default async function ImpersonationBanner() {
  const imp = await getImpersonation();
  if (!imp) return null;
  const tenant = await getTenantById(imp.tenantId);
  const name = tenant?.name || tenant?.igUsername || tenant?.email || imp.tenantId;

  return (
    <div className="sticky top-0 z-50 bg-sandstorm text-void">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span className="font-semibold">
          Viewing as {name}
        </span>
        <span className="hidden opacity-70 sm:inline">read-only</span>
        <nav className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {STEPS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="inline-flex min-h-8 items-center py-1 underline-offset-2 opacity-80 transition-opacity hover:underline hover:opacity-100"
            >
              {s.label}
            </a>
          ))}
          <a
            href={`/admin/api/impersonate/stop`}
            className="inline-flex min-h-8 items-center rounded bg-void px-3 py-1.5 font-semibold text-sandstorm transition-colors hover:bg-graphite"
          >
            Exit
          </a>
        </nav>
      </div>
    </div>
  );
}
