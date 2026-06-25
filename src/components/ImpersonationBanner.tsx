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
    <div className="sticky top-0 z-50 bg-sandstorm text-black">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold">
          Viewing as {name}
        </span>
        <span className="hidden sm:inline opacity-70">read-only</span>
        <nav className="flex items-center gap-3 ml-auto">
          {STEPS.map((s) => (
            <a key={s.href} href={s.href} className="underline-offset-2 hover:underline opacity-80 hover:opacity-100">
              {s.label}
            </a>
          ))}
          <a
            href={`/admin/api/impersonate/stop`}
            className="font-semibold rounded bg-black text-sandstorm px-3 py-1 hover:bg-zinc-900"
          >
            Exit
          </a>
        </nav>
      </div>
    </div>
  );
}
