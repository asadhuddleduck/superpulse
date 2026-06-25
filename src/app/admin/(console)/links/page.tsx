import { headers } from "next/headers";
import { listSignupLinks, isLinkRedeemable } from "@/lib/queries/signup-links";
import { shortDate, timeAgo } from "@/lib/hq-format";
import { Pill } from "../ui";
import CopyField from "./copy-field";
import LinkForm from "./link-form";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { paid: "Pay to join", prepaid: "Prepaid", magic: "Resume" };
const ERRORS: Record<string, string> = {
  type: "Pick a valid link type.",
  magic_target: "Resume links need a target tenant ID.",
  no_email: "That link has no email on file.",
  email_failed: "Could not send the email. Try again.",
  not_found: "Link not found.",
};

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; sent?: string; error?: string }>;
}) {
  const { created, sent, error } = await searchParams;
  const [links, base] = await Promise.all([listSignupLinks(), origin()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Join links</h1>
        <p className="text-sm text-zinc-500">Invite clients to onboard. Pay-to-join, prepaid/comp, or resume.</p>
      </div>

      {sent && (
        <div className="rounded-lg border border-viridian/40 bg-viridian/10 px-3 py-2 text-sm text-viridian">
          Email sent.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}
      {created && (
        <div className="rounded-xl border border-viridian/40 bg-viridian/5 p-4">
          <div className="mb-2 text-sm font-medium text-viridian">Link created. Share it:</div>
          <CopyField value={`${base}/join/${created}`} />
        </div>
      )}

      {/* Create */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">New link</h2>
        <LinkForm />
      </div>

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400">All links ({links.length})</h2>
        {links.length === 0 && <p className="text-sm text-zinc-600">No links yet.</p>}
        {links.map((l) => {
          const live = isLinkRedeemable(l);
          return (
            <div key={l.id} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Pill tone={l.type === "prepaid" ? "green" : l.type === "magic" ? "amber" : "zinc"}>
                  {TYPE_LABEL[l.type] ?? l.type}
                </Pill>
                {l.label && <span className="text-sm text-zinc-300">{l.label}</span>}
                {l.email && <span className="text-xs text-zinc-500">{l.email}</span>}
                {l.stripeCoupon && <span className="text-xs text-zinc-500">coupon {l.stripeCoupon}</span>}
                <span className="ml-auto text-xs text-zinc-600">
                  {l.usedCount}/{l.maxUses} used · {live ? "active" : l.status}
                  {l.expiresAt ? ` · expires ${shortDate(l.expiresAt)}` : ""}
                  {l.lastUsedAt ? ` · last used ${timeAgo(l.lastUsedAt)}` : ""}
                </span>
              </div>
              <CopyField value={`${base}/join/${l.token}`} />
              <div className="mt-2 flex gap-2">
                {l.email && live && (
                  <form method="post" action={`/admin/api/links/${l.id}/email`}>
                    <button className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900">
                      Email it
                    </button>
                  </form>
                )}
                {l.status === "active" && (
                  <form method="post" action={`/admin/api/links/${l.id}/revoke`}>
                    <button className="rounded-lg border border-red-900/50 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40">
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
