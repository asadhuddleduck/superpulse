import type { Metadata } from "next";
import Link from "next/link";
import { Hero, Section, Callout, Faq } from "../ui";

export const metadata: Metadata = {
  title: "SuperPulse operator guide",
  description: "How the team runs the Agency HQ console.",
  robots: { index: false, follow: false },
};

export default function TeamGuide() {
  return (
    <article>
      <Hero
        kicker="For the team"
        title="Running the Agency HQ console"
        sub="The console at admin.superpulse.io is where the team onboards SuperPulse clients, watches their accounts, and handles billing, lifecycle, and who can do what. Clients never see any of this. Their app is a separate login."
      />

      <Section title="Getting in">
        <p>
          Sign in at <strong className="text-white">admin.superpulse.io</strong> with your work email and password
          (nothing to do with the Instagram login clients use).
        </p>
        <ul className="ml-5 list-disc space-y-1.5 text-zinc-300">
          <li>
            <strong className="text-white">First time:</strong> open the invite link you were emailed and set a
            password (at least 12 characters), which signs you straight in. Invite links last 7 days; if yours has
            expired, ask whoever invited you to resend it.
          </li>
          <li>
            <strong className="text-white">Forgot it:</strong> hit &ldquo;Forgot?&rdquo; on the sign-in screen and we
            email a reset link (valid for an hour) if the account exists.
          </li>
        </ul>
        <p>Sessions last 30 days. Disabling an operator, or logging them out, also kills any &ldquo;view as client&rdquo; session they had open.</p>
        <Callout tone="gold">
          This console holds the keys to every client account, so it is rate-limited and locks out repeated bad
          logins. Use a password manager and never share a login.
        </Callout>
      </Section>

      <Section title="The client roster">
        <p>
          The <strong className="text-white">Clients</strong> page is the console home. Across the top are the
          headline numbers: total clients, Live, Onboarding, Churned, and estimated MRR. Below that you can filter
          (All / Live / Onboarding / Paused / Churned / Legacy) and search by business name, handle, email, or tenant
          ID.
        </p>
        <p>
          Each row shows the client&rsquo;s stage, plan, connected accounts (ad account, locations, live campaigns),
          spend this month, and last activity. The <strong className="text-white">+ Add client</strong> button takes
          you to Join links.
        </p>
      </Section>

      <Section title="Opening a client">
        <p>Click a row to open the detail page. It pulls together everything about that client:</p>
        <ul className="ml-5 list-disc space-y-1.5 text-zinc-300">
          <li>Header with their stage, handle, email, join date, and Legacy or Comped pills if they apply.</li>
          <li>An onboarding stepper showing how far through setup they are.</li>
          <li>Billing: plan and price, Stripe status, renewal, and a link out to their Stripe record. Legacy clients read &ldquo;grandfathered&rdquo;, comped clients read &ldquo;free access, no charge&rdquo;.</li>
          <li>Connected accounts (Instagram, Facebook page, ad account, token status), their locations, and performance (spend, profile visits, impressions, live vs paused campaigns).</li>
          <li>A recent-activity feed (their scans, boosts, billing) and an operator log (what the team has done to the account).</li>
        </ul>
        <p>The action buttons live top-right of the detail page. Which ones show depends on the client&rsquo;s state and your role.</p>
      </Section>

      <Section title="View as client">
        <p>
          &ldquo;View as client&rdquo; drops you into that client&rsquo;s real dashboard, exactly as they see it, with a
          yellow banner across the top: &ldquo;Viewing as [name]&rdquo;, marked read-only, with quick links to walk
          their onboarding screens and an <strong className="text-white">Exit</strong> button.
        </p>
        <ul className="ml-5 list-disc space-y-1.5 text-zinc-300">
          <li>It is strictly read-only. Every change on the client side is blocked while you view as them, so you can look but never touch.</li>
          <li>Hit Exit to drop back to the console. The session also ends on its own after 2 hours.</li>
          <li>It needs admin level or above, because you are seeing a client&rsquo;s full account. Members do not see the button.</li>
        </ul>
        <p>Use it to see exactly what a client sees, debug a stuck onboarding, or check their live status from their side.</p>
      </Section>

      <Section title="Join links">
        <p>
          Join links are how you bring a business on. Create one on the <strong className="text-white">Join links</strong> page
          (or the + Add client button): pick a type, optionally add an internal label and the client&rsquo;s email, set
          how many uses and an expiry, then create it. Copy the <code className="text-zinc-200">superpulse.io/join/&lt;token&gt;</code> link
          and send it, or use &ldquo;Email it&rdquo; if you put an email on the link. Each link shows its uses, status,
          expiry, and last use, and you can revoke an active one. Any operator can create links.
        </p>
        <p>Three types:</p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Paid:</strong> the normal one. They check out (£27/location) on the pricing page
            before they get access. You can prefill a Stripe coupon (for example FIRSTMONTHFREE). Use for a standard
            new paying client.
          </li>
          <li>
            <strong className="text-white">Prepaid (comp):</strong> free access, no card. They go straight to
            connecting Instagram and the account is flagged comped once they finish connecting (so an unclicked link
            does not burn the grant). Use for a pilot or a deal you have agreed to cover.
          </li>
          <li>
            <strong className="text-white">Magic (re-invite):</strong> for a client who already has an account with us
            (you set the target tenant ID). It binds only to that client: when they log in with their own Instagram it
            picks up their existing account. If anyone else opens the link, it grants nothing. Use to get a stuck or
            returning client back in without making them pay again.
          </li>
        </ul>
        <Callout>
          Send each link to one person. Prepaid and magic links are tied to a real grant, so treat them like a key:
          do not drop them in a shared channel.
        </Callout>
      </Section>

      <Section title="Client lifecycle">
        <p>The controls on a client&rsquo;s detail page. Per the spend rule, nothing is ever deleted, only paused.</p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Pause / Reactivate:</strong> pauses or resumes their live ads and our
            processing. Billing is left alone. Use for a temporary stop (a payment grace, a client request, something
            you are looking into). Any operator.
          </li>
          <li>
            <strong className="text-white">Mark comped / Remove comp:</strong> turns free access on or off. A comped
            client skips the billing gate; removing it means they need a paid subscription to stay live. Any operator.
          </li>
          <li>
            <strong className="text-white">Offboard:</strong> the hard exit. Cancels their Stripe subscription, pauses
            every live ad, and revokes their dashboard access. Campaigns are paused, never deleted. Admin or above.
          </li>
          <li>
            <strong className="text-white">Reinstate:</strong> brings an offboarded client back to active (only works
            on someone actually offboarded). It does not restore free access, so if they were comped, set Comp again
            afterwards. Admin or above.
          </li>
        </ul>
        <Callout>
          Quick distinction: Pause is a temporary stop that keeps billing and access. Offboard ends the relationship
          (cancels billing, revokes access). Comp is about who pays, not about whether they are live.
        </Callout>
      </Section>

      <Section title="Your team and roles">
        <p>
          The <strong className="text-white">Team</strong> page (admin and owner only) is where you manage who can
          operate the console. Invite a teammate by email with a name and a role, then send it. They get an invite
          email, and you can also copy the accept link from the success banner. Anyone who has not set a password yet
          can be re-sent the invite. New people come in as a member by default.
        </p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Member:</strong> sees the roster and client detail, creates and sends join
            links, and runs the everyday lifecycle (pause, reactivate, comp, uncomp). Cannot view as a client,
            offboard or reinstate, or see the Team page.
          </li>
          <li>
            <strong className="text-white">Admin:</strong> everything a member can do, plus view as client, offboard
            and reinstate, and the Team page (invite and manage teammates up to admin, disable and re-enable).
          </li>
          <li>
            <strong className="text-white">Owner:</strong> full control, including making other people owners. Only an
            owner can create or change another owner.
          </li>
        </ul>
        <Callout tone="gold">
          Guard rails: you cannot change your own role or disable yourself, a non-owner cannot touch an owner, and the
          console blocks you from disabling or demoting the last active owner.
        </Callout>
      </Section>

      <Section title="Admin questions">
        <Faq
          items={[
            {
              q: "Can ‘view as client’ break anything?",
              a: "No. It is read-only end to end. Every write on the client side is blocked while you are viewing as them, so you can look but not touch. Exit returns you to the console, and the session ends on its own after 2 hours.",
            },
            {
              q: "Pause or Offboard, which do I use?",
              a: "Pause for anything temporary: it keeps billing and access, it just stops the ads. Offboard is the real exit: it cancels Stripe, pauses everything, and locks them out. Reinstate brings an offboarded client back.",
            },
            {
              q: "Which join link for a brand-new paying client?",
              a: "A Paid link: they check out first, then onboard. Use Prepaid only when we have agreed to cover them (a pilot or a deal).",
            },
            {
              q: "A magic link is not logging my client in. Why?",
              a: "Magic links bind to one specific existing client and only work when that client logs in with their own Instagram. If the account does not match, it grants nothing, on purpose. For a fresh sign-up use a Paid or Prepaid link.",
            },
            {
              q: "A client got stuck halfway through onboarding. How do I help?",
              a: "If you are admin, use ‘view as client’ to see exactly where they are stuck. To get an existing client back in, send a magic re-invite (you will need their tenant ID); they log back in with their own Instagram and pick up where they left off.",
            },
            {
              q: "I reinstated a comped client and they hit the pricing page.",
              a: "Reinstate does not restore free access by design. Open the client and set Comp again.",
            },
            {
              q: "Why can’t I see the Team page or offboard a client?",
              a: "You are a member. View as client, offboard, reinstate, and team management are admin and above. Members can create join links and pause, reactivate, and comp clients. Ask an owner to bump you up.",
            },
          ]}
        />
      </Section>

      <p className="mt-12 text-sm text-zinc-600">
        Looking for the client-facing version? <Link href="/guide" className="text-[#1EBA8F] hover:underline">Read the owner guide.</Link>
      </p>
    </article>
  );
}
