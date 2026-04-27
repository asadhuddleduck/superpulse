import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById } from "@/lib/queries/tenants";
import { fetchPagesWithIG } from "@/lib/facebook";
import { SelectPageForm } from "./select-page-form";

export const metadata: Metadata = {
  title: "Choose Your Page — SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function SelectPagePage() {
  const tenantId = await getTenantCookie();
  if (!tenantId) redirect("/login");

  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/login");

  if (tenant.status !== "pending_page_selection") {
    redirect("/dashboard");
  }

  const token = tenant.metaAccessToken;
  if (!token) redirect("/login");

  const pages = await fetchPagesWithIG(token);
  const pagesWithIG = pages.filter((p) => p.instagram_business_account);

  if (pagesWithIG.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6">
        <main className="max-w-md text-center text-zinc-300">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-6 text-zinc-400">
            We couldn&apos;t find an Instagram Business Account linked to any of your Facebook Pages.
            Connect one in Meta Business Suite, then come back and log in again.
          </p>
          <a href="/login" className="mt-6 inline-block text-viridian hover:underline">
            Back to login
          </a>
        </main>
      </div>
    );
  }

  if (pagesWithIG.length === 1) {
    redirect("/api/onboarding/select-page?pageId=" + pagesWithIG[0].id);
  }

  const choices = pagesWithIG.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    igUserId: p.instagram_business_account!.id,
  }));

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6 py-12">
      <main className="w-full max-w-xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            You manage {choices.length} Pages with Instagram. Pick the one SuperPulse should boost from.
          </p>
        </header>

        <SelectPageForm choices={choices} />

        <p className="mt-6 text-center text-xs text-zinc-500">
          You can switch later in Settings.
        </p>
      </main>
    </div>
  );
}
