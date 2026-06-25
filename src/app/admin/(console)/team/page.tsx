import { headers } from "next/headers";
import { requireRole } from "@/lib/hq-auth";
import { listHqUsers } from "@/lib/queries/hq-users";
import { timeAgo } from "@/lib/hq-format";
import { Pill } from "../ui";
import CopyField from "../links/copy-field";

export const dynamic = "force-dynamic";

const inputCls = "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm outline-none focus:border-viridian";
const ERRORS: Record<string, string> = {
  forbidden: "You don't have permission for that.",
  missing: "Enter an email.",
  exists: "That email is already on the team.",
  self: "You can't disable your own account.",
  not_found: "User not found.",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; to?: string; error?: string }>;
}) {
  const me = await requireRole("admin");
  const { invited, to, error } = await searchParams;
  const users = await listHqUsers();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-zinc-500">Who can operate the HQ. Invite teammates, set roles, revoke access.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}
      {invited && (
        <div className="rounded-xl border border-viridian/40 bg-viridian/5 p-4">
          <div className="mb-2 text-sm font-medium text-viridian">
            Invite sent{to ? ` to ${to}` : ""}. Share this link too if needed:
          </div>
          <CopyField value={`${base}/admin/accept?token=${invited}`} />
        </div>
      )}

      {/* Invite */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">Invite a teammate</h2>
        <form action="/admin/api/team/invite" method="post" className="grid gap-3 sm:grid-cols-4">
          <input name="email" type="email" required placeholder="teammate@email.com" className={`${inputCls} sm:col-span-2`} />
          <input name="name" placeholder="Name" className={inputCls} />
          <select name="role" defaultValue="member" className={inputCls}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            {me.role === "owner" && <option value="owner">Owner</option>}
          </select>
          <button className="rounded-lg bg-viridian px-4 py-2 text-sm font-semibold text-black hover:bg-viridian/90 sm:col-span-4 sm:w-auto">
            Send invite
          </button>
        </form>
      </div>

      {/* Members */}
      <div className="overflow-hidden rounded-xl border border-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isOwner = u.role === "owner";
              const canModify = !(isOwner && me.role !== "owner");
              return (
                <tr key={u.id} className="border-b border-zinc-900/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-white">{u.name || u.email}</div>
                    {u.name && <div className="text-xs text-zinc-500">{u.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {canModify && u.id !== me.id ? (
                      <form action={`/admin/api/team/${u.id}/role`} method="post" className="flex items-center gap-2">
                        <select name="role" defaultValue={u.role} className="rounded border border-zinc-800 bg-black px-2 py-1 text-xs">
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          {me.role === "owner" && <option value="owner">owner</option>}
                        </select>
                        <button className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900">Set</button>
                      </form>
                    ) : (
                      <span className="capitalize text-zinc-400">{u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={u.status === "active" ? "green" : u.status === "invited" ? "amber" : "red"}>
                      {u.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {u.status === "invited" && (
                        <form action={`/admin/api/team/${u.id}/resend`} method="post">
                          <button className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900">Resend</button>
                        </form>
                      )}
                      {canModify && u.id !== me.id && u.status !== "disabled" && (
                        <form action={`/admin/api/team/${u.id}/disable`} method="post">
                          <button className="rounded border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40">Disable</button>
                        </form>
                      )}
                      {u.status === "disabled" && (
                        <form action={`/admin/api/team/${u.id}/enable`} method="post">
                          <button className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900">Enable</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
