import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import crypto from "crypto";
import { getCurrentTenant } from "@/lib/auth";
import { buildOAuthURL } from "@/lib/facebook";

export const metadata: Metadata = {
  title: "Connect Instagram — SuperPulse",
};

export default async function ConnectPage() {
  const tenant = await getCurrentTenant();

  // Already connected? Skip ahead.
  if (tenant?.metaAccessToken && tenant.status === "active") {
    redirect("/dashboard");
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback/facebook`;
  const state = crypto.randomBytes(16).toString("hex");
  const oauthUrl = buildOAuthURL(redirectUri, state);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </Link>
          <a
            href="/api/auth/logout"
            className="text-sm text-zinc-500 hover:text-white transition"
          >
            Sign out
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="rounded-lg border border-viridian/30 bg-viridian/5 px-4 py-3 mb-8 text-sm text-viridian">
          Payment confirmed. One step to go — connect your Instagram.
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Connect your Instagram
        </h1>
        <p className="text-zinc-400 mb-8">
          We use Facebook Login because Instagram&apos;s ad system runs through
          your Facebook Page. We&apos;ll request the minimum permissions to
          read your posts and create paused boost campaigns on your behalf.
        </p>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <ul className="space-y-3 mb-6 text-sm text-zinc-300">
            <Bullet>Facebook Page → Instagram Business account</Bullet>
            <Bullet>Ad account access (so we can launch boosts)</Bullet>
            <Bullet>Read your post engagement (no posting on your behalf)</Bullet>
          </ul>

          <a
            href={oauthUrl}
            className="block w-full rounded-lg bg-[#1877F2] px-5 py-3 text-center text-base font-semibold text-white hover:bg-[#1877F2]/90 transition"
          >
            Continue with Facebook
          </a>
        </div>

        <p className="text-sm text-zinc-500 mt-8 text-center">
          Stuck?{" "}
          <Link href="/onboarding/support" className="text-viridian hover:underline">
            See onboarding support
          </Link>
        </p>
      </main>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        className="h-5 w-5 text-viridian shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}
