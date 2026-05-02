import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTenantCookie } from "@/lib/auth";
import { getTenantById } from "@/lib/queries/tenants";
import { fetchAdAccounts } from "@/lib/facebook";
import { SelectAdAccountForm } from "./select-ad-account-form";

export const metadata: Metadata = {
  title: "Choose Your Ad Account — SuperPulse",
};

export const dynamic = "force-dynamic";

export default async function SelectAdAccountPage() {
  const tenantId = await getTenantCookie();
  if (!tenantId) redirect("/login");

  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/login");

  if (tenant.status !== "pending_ad_account") {
    redirect("/dashboard");
  }

  const token = tenant.metaAccessToken;
  if (!token) redirect("/login");

  const all = await fetchAdAccounts(token);

  // Hide non-spendable accounts (status != 1 ACTIVE). The note below the list
  // explains why an expected account might be missing so users don't have to
  // ask support.
  const eligible = all
    .filter((a) => a.account_status === 1)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (eligible.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6">
        <main className="max-w-md text-center text-zinc-300">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-6 text-zinc-400">
            We couldn&apos;t find any active ad accounts on your Meta login.
            Set up an ad account in Meta Business Suite (with billing
            settled), then come back and log in again.
          </p>
          <a href="/login" className="mt-6 inline-block text-viridian hover:underline">
            Back to login
          </a>
        </main>
      </div>
    );
  }

  const choices = eligible.map((a) => {
    const rawId = a.id.startsWith("act_") ? a.id.slice(4) : a.id;
    return {
      adAccountId: rawId,
      name: a.name,
      businessName: a.business?.name ?? "(personal)",
      currency: a.currency,
    };
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black px-6 py-12">
      <main className="w-full max-w-xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            Pick the ad account SuperPulse should use for your boosts. Spend
            and billing happen on this account.
          </p>
        </header>

        <SelectAdAccountForm choices={choices} />

        <p className="mt-6 text-xs text-zinc-500 leading-relaxed">
          <span className="text-zinc-400">Don&apos;t see an account?</span>{" "}
          We only show accounts that are ACTIVE and spendable. Closed,
          disabled, unsettled, or in-grace-period accounts are hidden — fix
          billing or restore access in Meta Business Suite, then log in again.
        </p>
      </main>
    </div>
  );
}
