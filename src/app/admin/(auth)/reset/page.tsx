import Link from "next/link";
import { verifyResetToken } from "@/lib/hq-auth";
import { getHqUserById } from "@/lib/queries/hq-users";
import SetPasswordForm from "../set-password-form";

export const dynamic = "force-dynamic";

export default async function HqResetPage({
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
        <h1 className="text-lg font-semibold mb-1">Link expired</h1>
        <p className="text-sm text-zinc-500 mb-5">
          This reset link is invalid or has already been used.
        </p>
        <Link href="/admin/forgot" className="text-sm text-viridian hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Set a new password</h1>
      <p className="text-sm text-zinc-500 mb-5">{user?.email ?? "Choose a new password."}</p>
      <SetPasswordForm token={token} path="/admin/reset" email={user?.email ?? null} cta="Save & sign in" error={error} />
    </div>
  );
}
