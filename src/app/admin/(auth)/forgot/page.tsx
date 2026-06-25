import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HqForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <div>
        <h1 className="text-lg font-semibold mb-1">Check your email</h1>
        <p className="text-sm text-zinc-500 mb-5">
          If that email is on the team, a reset link is on its way. It expires in an hour.
        </p>
        <Link href="/admin/login" className="text-sm text-viridian hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Reset password</h1>
      <p className="text-sm text-zinc-500 mb-5">We'll email you a link to set a new one.</p>
      <form action="/admin/api/auth/forgot" method="post" className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-viridian"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-viridian px-4 py-2.5 text-sm font-semibold text-black hover:bg-viridian/90 transition-colors"
        >
          Send reset link
        </button>
      </form>
      <Link href="/admin/login" className="block mt-4 text-sm text-zinc-500 hover:text-viridian">
        Back to sign in
      </Link>
    </div>
  );
}
