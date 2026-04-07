import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTokenCookie } from "@/lib/auth";
import { fetchMe, fetchPagesWithIG } from "@/lib/facebook";
import type { PageWithIG } from "@/lib/facebook";

export const metadata: Metadata = {
  title: "Dashboard — SuperPulse",
  description: "Your SuperPulse dashboard — manage your Instagram ad boosting.",
};

export default async function DashboardPage() {
  const token = await getTokenCookie();
  if (!token) {
    redirect("/login");
  }

  let user: { id: string; name: string; email?: string };
  let pages: PageWithIG[];

  try {
    [user, pages] = await Promise.all([
      fetchMe(token),
      fetchPagesWithIG(token),
    ]);
  } catch (err) {
    console.error("Failed to fetch Facebook data:", err);
    redirect("/login");
  }

  const pagesWithIG = pages.filter((p) => p.instagram_business_account);
  const pagesWithoutIG = pages.filter((p) => !p.instagram_business_account);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.name}</span>
            <a
              href="/api/auth/logout"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Log out
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white">
            Welcome, {user.name.split(" ")[0]}
          </h2>
          {user.email && (
            <p className="text-zinc-500 mt-1">{user.email}</p>
          )}
        </div>

        {/* Connected Pages with IG */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-viridian mb-4">
            Connected Pages with Instagram
          </h3>
          {pagesWithIG.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
              <p className="text-zinc-400">
                No Pages with linked Instagram Business accounts found.
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                Make sure your Instagram account is converted to a Business or Creator account
                and linked to a Facebook Page.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pagesWithIG.map((page) => (
                <div
                  key={page.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
                >
                  <p className="font-semibold text-white">{page.name}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Page ID: {page.id}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-viridian" />
                    <span className="text-sm text-viridian">
                      IG Account: {page.instagram_business_account!.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pages without IG */}
        {pagesWithoutIG.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-zinc-400 mb-4">
              Pages without Instagram
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {pagesWithoutIG.map((page) => (
                <div
                  key={page.id}
                  className="rounded-lg border border-zinc-800/50 bg-zinc-950 p-5"
                >
                  <p className="font-semibold text-zinc-300">{page.name}</p>
                  <p className="text-sm text-zinc-600 mt-1">
                    Page ID: {page.id}
                  </p>
                  <p className="text-xs text-zinc-600 mt-2">
                    No Instagram Business account linked
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
