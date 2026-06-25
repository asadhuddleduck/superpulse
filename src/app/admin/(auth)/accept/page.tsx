import Link from "next/link";
import { verifyResetToken } from "@/lib/hq-auth";
import { getHqUserById } from "@/lib/queries/hq-users";
import SetPasswordForm from "../set-password-form";

export const dynamic = "force-dynamic";

export default async function HqAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const rec = token ? await verifyResetToken(token) : null;
  const user = rec ? await getHqUserById(rec.userId) : null;

  if (!token || (!rec && !error)) {
    return (
      <div>
        <h1 className="text-lg font-semibold mb-1">Invite expired</h1>
        <p className="text-sm text-zinc-500 mb-5">
          This invite link is invalid or has already been used. Ask whoever invited you to resend it.
        </p>
        <Link href="/admin/login" className="text-sm text-viridian hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Welcome to SuperPulse HQ</h1>
      <p className="text-sm text-zinc-500 mb-5">
        {user?.email ? `Set a password for ${user.email}.` : "Set a password to get started."}
      </p>
      <SetPasswordForm token={token} path="/admin/accept" email={user?.email ?? null} cta="Set password & enter" error={error} />
    </div>
  );
}
