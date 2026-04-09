import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTokenCookie } from "@/lib/auth";
import { buildOAuthURL } from "@/lib/facebook";
import { headers } from "next/headers";
import crypto from "crypto";

export const metadata: Metadata = {
  title: "Login — SuperPulse",
  description: "Connect your Instagram via Facebook to get started with SuperPulse.",
};

export default async function LoginPage() {
  // If already logged in, redirect to dashboard
  const token = await getTokenCookie();
  if (token) {
    redirect("/dashboard");
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback/facebook`;
  const state = crypto.randomBytes(16).toString("hex");
  const oauthUrl = buildOAuthURL(redirectUri, state);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-black">
      <main className="flex flex-col items-center gap-8 text-center px-6 max-w-md">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-viridian">Super</span>
            <span className="text-sandstorm">Pulse</span>
          </h1>
          <p className="mt-3 text-zinc-400 leading-relaxed">
            Connect your Instagram via Facebook to start boosting your best posts to local audiences.
          </p>
        </div>

        <a
          href={oauthUrl}
          className="inline-flex items-center gap-3 rounded-lg bg-[#1877F2] px-6 py-3.5 text-white font-semibold text-base transition-all hover:bg-[#166FE5] hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#1877F2]/20"
        >
          <svg
            className="h-5 w-5 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Connect with Facebook
        </a>

        <div className="space-y-3 text-sm text-zinc-500">
          <p>We need Facebook Login to access the Marketing API for ad boosting.</p>
          <p>
            Your data is handled securely.{" "}
            <a href="/privacy" className="text-viridian hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
