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
        sub="This is the internal console at admin.superpulse.io. It is where the team onboards clients, watches their accounts, and handles billing and lifecycle. Clients never see any of this; their app is a separate login."
      />

      <Section title="Getting in">
        <p>
          The console lives at <strong className="text-white">admin.superpulse.io</strong>. You sign in with your
          work email and a password (this is nothing to do with the Instagram login clients use).
        </p>
        <ul className="ml-5 list-disc space-y-1 text-zinc-300">
          <li>
            <strong className="text-white">First time:</strong> open the invite link you were sent and set a password
            (at least 12 characters). That signs you straight in.
          </li>
          <li>
            <strong className="text-white">Forgot it:</strong> use the &ldquo;Forgot password&rdquo; link on the sign-in
            page. You get a reset email if the account exists.
          </li>
        </ul>
        <Callout tone="gold">
          The console is the keys to every client account, so it is rate-limited and locks out repeated bad logins.
          Use a real password manager and do not share logins.
        </Callout>
      </Section>

      <Section title="The client roster">
        <p>
          The home screen lists every client. For each one you can see their stage and status, how many locations
          they have, how many ad campaigns are live, their spend this month, and when they were last active.
          Offboarded clients drop to the bottom.
        </p>
      </Section>

      <Section title="Opening a client">
        <p>
          Click a client to open their detail page. That shows their connected accounts, locations, recent
          performance, billing state, and an activity log. The action buttons for that client live here too
          (pause, comp, offboard, and view as client).
        </p>
      </Section>

      <Section title="View as client">
        <p>
          &ldquo;View as client&rdquo; drops you into that client&rsquo;s real dashboard exactly as they see it, with a
          banner across the top showing whose account you are in. Use it to check what a client is looking at or to
          walk them through a screen.
        </p>
        <ul className="ml-5 list-disc space-y-1 text-zinc-300">
          <li>It is strictly read-only. You cannot change a client&rsquo;s settings or locations while viewing as them.</li>
          <li>Hit <strong className="text-white">Exit</strong> in the banner to come back to the console.</li>
          <li>It needs admin level or above, because you are seeing a client&rsquo;s full account.</li>
        </ul>
      </Section>

      <Section title="Join links">
        <p>Join links are how you bring someone onto SuperPulse. Create one, then send it. There are three kinds:</p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Paid</strong>: the normal one. They land on checkout (£300/mo, with a
            coupon prefilled if you set one), pay, then onboard. Use for a standard new client.
          </li>
          <li>
            <strong className="text-white">Prepaid (comp)</strong>: free access, no card. They go straight to
            connecting Instagram and we flag the account as comped. Use for a deal you have agreed to cover, or a
            partner.
          </li>
          <li>
            <strong className="text-white">Magic</strong>: a re-invite for a client who already has an account
            with us. It binds only to that client: when they log in with their own Instagram it picks up their
            existing account. If anyone else opens the link, it does nothing for them. Use to get an existing client
            back in without making them pay again.
          </li>
        </ul>
        <Callout>
          Send each link to one person. Magic and prepaid links are tied to a real grant, so treat them like a key:
          do not post them in a shared channel.
        </Callout>
      </Section>

      <Section title="Client lifecycle">
        <p>Once a client is on, these are the controls on their detail page:</p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Pause / Reactivate</strong>: stops or resumes our work on their
            account (we stop processing and boosting). Billing is left alone. Use for a short break.
          </li>
          <li>
            <strong className="text-white">Comp / Uncomp</strong>: turns free access on or off. A comped client
            skips the billing gate.
          </li>
          <li>
            <strong className="text-white">Offboard</strong>: the full exit. We cancel their subscription, pause
            every live ad, and mark them offboarded. Nothing is ever deleted (we keep the history). Admin level or above.
          </li>
          <li>
            <strong className="text-white">Reinstate</strong>: brings an offboarded client back to active. It
            only works on someone who was actually offboarded. It does not put their free access back, so if they were
            comped, set Comp again after. Admin level or above.
          </li>
        </ul>
      </Section>

      <Section title="Your team and roles">
        <p>
          Invite teammates from the Team tab. New people come in as a <strong className="text-white">member</strong> by
          default. The three roles:
        </p>
        <ul className="ml-5 list-disc space-y-2 text-zinc-300">
          <li>
            <strong className="text-white">Member</strong>: can see the roster and client detail, and can pause,
            reactivate, and comp clients. Cannot view as a client, offboard, or manage the team.
          </li>
          <li>
            <strong className="text-white">Admin</strong>: everything a member can do, plus view as client,
            offboard and reinstate, and invite or manage teammates.
          </li>
          <li>
            <strong className="text-white">Owner</strong>: full control, including making other people owners.
          </li>
        </ul>
        <Callout tone="gold">
          There must always be at least one owner. The console will block you from disabling or demoting the last one.
        </Callout>
      </Section>

      <Section title="Admin questions">
        <Faq
          items={[
            {
              q: "Is admin.superpulse.io the same as the client app?",
              a: "No. Clients log into their own app with Instagram. This console is a separate email-and-password login for the team only, and clients never reach it.",
            },
            {
              q: "What is the difference between Pause and Offboard?",
              a: "Pause is a temporary stop (we stop working, billing continues). Offboard is the full exit: subscription cancelled, all ads paused, marked offboarded. Reinstate reverses an offboard.",
            },
            {
              q: "Which link do I send a brand-new paying client?",
              a: "A Paid link. They check out first, then onboard. Use Prepaid only when we have agreed to cover them.",
            },
            {
              q: "A magic link is not logging my client in. Why?",
              a: "Magic links bind to one specific existing client and only work when that client logs in with their own Instagram. If the account does not match, it grants nothing on purpose. For a fresh sign-up use a Paid or Prepaid link instead.",
            },
            {
              q: "I reinstated a comped client and they hit the pricing page.",
              a: "Reinstate does not restore free access by design. Open the client and set Comp again.",
            },
            {
              q: "Can a member offboard a client or view their account?",
              a: "No. View-as-client, offboard, reinstate, and team management are admin and above. Members can pause, reactivate, and comp.",
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
