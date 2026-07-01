import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import crypto from "crypto";
import { getCurrentTenant } from "@/lib/auth";
import { buildOAuthURL } from "@/lib/facebook";
import { OnboardingShell } from "@/components/ui/OnboardingShell";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Connect Instagram | SuperPulse",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const tenant = await getCurrentTenant();

  // Already connected? Skip ahead.
  if (tenant?.metaAccessToken && tenant.status === "active") {
    redirect("/dashboard");
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback/facebook`;
  // Arriving from Stripe checkout carries ?session_id. Round-trip it through the
  // OAuth `state` so the callback can attach the subscription to the real
  // IG-keyed tenant (Stripe session ids are unguessable, so they double as the
  // CSRF nonce here). Organic visits get a random state.
  const { session_id } = await searchParams;
  const state = session_id ? `chk:${session_id}` : crypto.randomBytes(16).toString("hex");
  const oauthUrl = buildOAuthURL(redirectUri, state);

  return (
    <OnboardingShell
      maxWidth="2xl"
      headerRight={
        <a
          href="/api/auth/logout"
          className="text-mist transition hover:text-white"
        >
          Sign out
        </a>
      }
    >
      <FadeIn>
        <OnboardingProgress step="connect" />

        <Card variant="success" className="mb-8 text-sm text-viridian">
          Payment confirmed. One step to go, connect your Instagram.
        </Card>

        <PageHeading
          title="Connect your Instagram"
          subtitle="We use Facebook Login because Instagram's ad system runs through your Facebook Page. We'll request the minimum permissions to read your posts and create paused boost campaigns on your behalf."
        />

        <Card className="mt-8">
          <ul className="space-y-3 mb-6 text-sm text-mist">
            <Bullet>Facebook Page → Instagram Business account</Bullet>
            <Bullet>Ad account access (so we can launch boosts)</Bullet>
            <Bullet>Read your post engagement (no posting on your behalf)</Bullet>
          </ul>

          <a
            href={oauthUrl}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#1877F2] px-5 py-3 text-center text-base font-semibold text-white transition hover:bg-[#1877F2]/90"
          >
            Continue with Facebook
          </a>
        </Card>

        <p className="text-sm text-mist mt-8 text-center">
          Stuck?{" "}
          <Link href="/onboarding/support" className="text-viridian hover:underline">
            See onboarding support
          </Link>
        </p>
      </FadeIn>
    </OnboardingShell>
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
