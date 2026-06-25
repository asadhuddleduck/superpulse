import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Wrong email or password.",
  missing: "Enter your email and password.",
  forbidden: "You don't have access to that.",
};

export default async function HqLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const errorMsg = error ? ERRORS[error] ?? "Something went wrong." : null;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">Sign in</h1>
      <p className="text-sm text-zinc-500 mb-5">Welcome back.</p>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Real form POST navigation so Safari / iCloud Keychain offers to save it. */}
      <form action="/admin/api/auth/login" method="post" className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/admin"} />
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
            placeholder="hello@asadshah.co.uk"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-viridian"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-xs font-medium text-zinc-400">
              Password
            </label>
            <Link href="/admin/forgot" className="text-xs text-zinc-500 hover:text-viridian">
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-viridian"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-viridian px-4 py-2.5 text-sm font-semibold text-black hover:bg-viridian/90 transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
