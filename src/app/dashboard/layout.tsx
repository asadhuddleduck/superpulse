import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth";
import { fetchMe } from "@/lib/facebook";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    redirect("/login");
  }

  // Pre-OAuth flow gate — paid customers come through Stripe before connecting.
  // Legacy tenants (legacy=1) bypass billing entirely and render dashboard.
  if (!tenant.legacy) {
    if (
      !tenant.subscriptionStatus ||
      tenant.subscriptionStatus === "pending" ||
      tenant.subscriptionStatus === "canceled"
    ) {
      redirect("/pricing");
    }
    if (tenant.subscriptionStatus === "past_due") {
      redirect("/pricing?reason=past_due");
    }
  }

  if (!tenant.metaAccessToken) {
    redirect("/onboarding/connect");
  }
  if (tenant.status === "pending_page_selection") {
    redirect("/onboarding/select-page");
  }
  if (tenant.status === "pending_ad_account") {
    redirect("/onboarding/select-ad-account");
  }

  let user: { id: string; name: string; email?: string };
  try {
    user = await fetchMe(tenant.metaAccessToken);
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/dashboard/posts">Posts</NavLink>
            <NavLink href="/dashboard/locations">Locations</NavLink>
            <NavLink href="/dashboard/settings">Settings</NavLink>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400 hidden sm:inline">
              {user.name}
            </span>
            <a
              href="/api/auth/logout"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Log out
            </a>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden border-t border-zinc-800/50">
          <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-4">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/dashboard/posts">Posts</NavLink>
            <NavLink href="/dashboard/locations">Locations</NavLink>
            <NavLink href="/dashboard/settings">Settings</NavLink>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-zinc-400 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
