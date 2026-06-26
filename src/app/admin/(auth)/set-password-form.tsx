// Shared set-password form for both /admin/reset and /admin/accept. Server
// component (no client JS). Includes a hidden username field so iCloud Keychain
// / Apple Passwords associates the new password with the right account.

const ERRORS: Record<string, string> = {
  weak: "Use at least 12 characters.",
  invalid: "That link is invalid or has expired. Request a new one.",
};

export default function SetPasswordForm({
  token,
  path,
  email,
  cta,
  error,
}: {
  token: string;
  path: "/admin/reset" | "/admin/accept";
  email: string | null;
  cta: string;
  error?: string;
}) {
  const errorMsg = error ? ERRORS[error] ?? "Something went wrong." : null;
  return (
    <>
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {errorMsg}
        </div>
      )}
      <form action="/admin/api/auth/set-password" method="post" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="path" value={path} />
        {/* Hidden username so the password manager files this under the account. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          defaultValue={email ?? ""}
          readOnly
          hidden
        />
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={12}
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm outline-none focus:border-viridian"
          />
          <p className="mt-1 text-xs text-zinc-600">At least 12 characters.</p>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-viridian px-4 py-2.5 text-sm font-semibold text-black hover:bg-viridian/90 transition-colors"
        >
          {cta}
        </button>
      </form>
    </>
  );
}
