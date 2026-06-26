import type { Metadata } from "next";
import Link from "next/link";
import { Hero, Section, Steps, Step, Callout, Faq } from "./ui";

export const metadata: Metadata = {
  title: "Getting started with SuperPulse",
  description: "How SuperPulse turns your Instagram posts into local ads.",
  robots: { index: false, follow: false },
};

export default function ClientGuide() {
  return (
    <article>
      <Hero
        kicker="For business owners"
        title="Getting started with SuperPulse"
        sub="Post on Instagram like you always do. SuperPulse takes your best posts and runs them as local ads that reach people near you. You set it up once, then leave it running. Here is the whole thing, start to finish."
      />

      <Section title="Setup, step by step">
        <Steps>
          <Step n={1} title="Connect with Facebook" see="A ‘Continue with Facebook’ button, then Facebook’s own permission screen.">
            <p>
              Tap the button and sign in through Facebook. Instagram&rsquo;s ad system runs through your Facebook
              page, so that is the door we use. You approve one screen that lets us read your posts and create boosts
              for you. Your password stays with Facebook, we never see it.
            </p>
          </Step>
          <Step n={2} title="Pick your page" see="A short list, only if you manage more than one. You can switch it later in Settings.">
            <p>
              If your account looks after a few pages with Instagram on them, choose the one this is for. If you only
              have one, we pick it and move on.
            </p>
          </Step>
          <Step n={3} title="Choose the ad account" see="Your active ad accounts. A missing one is usually a billing issue inside Meta.">
            <p>
              Pick the account your ad spend should bill to. We only show accounts that are active and ready to spend.
              This is separate from your SuperPulse subscription.
            </p>
          </Step>
          <Step n={4} title="Add your locations" see="‘Each one becomes its own local ad.’">
            <p>
              Add every shop or branch we should advertise around (one line per location). Each one becomes its own
              local ad aimed at people nearby, so your budget only goes to people who could actually walk in. Got a
              lot of sites? Paste them all into the &ldquo;add many at once&rdquo; box.
            </p>
          </Step>
          <Step n={5} title="Set your daily budget" see="‘This is your Meta ad spend, on your own ad account, separate from your subscription.’">
            <p>
              Choose how much each location spends per day. Most owners start around £5 a day each, which is enough to
              run steadily. We keep every location balanced so none of them runs away with your money, and you can
              change it any time.
            </p>
          </Step>
          <Step n={6} title="That is it, you are live" see="A setup progress bar (‘2 of 4 ready’), then ‘Live across your locations.’">
            <p>
              We build your ad sets and start your first boosts. Your first ads usually go live within about fifteen
              minutes, once Instagram has reviewed them, and we email you when they are running. You can close the tab.
              Nothing else is needed from you.
            </p>
          </Step>
        </Steps>
      </Section>

      <Section title="What SuperPulse does once you are set up">
        <p>
          You keep posting on Instagram. We watch your account, pick up your new posts, and decide which ones are
          worth putting money behind, how much, where, and for how long. We launch each one as a small local ad, watch
          how it does, move budget toward what is working, and quietly stop anything that is not. It runs around the
          clock so you do not have to think about it.
        </p>
        <p>
          The main thing we go after is profile visits: more of the right local people seeing you, following you, and
          turning up in person.
        </p>
        <Callout>
          Boosting inside the Instagram app adds Apple&rsquo;s in-app fee of roughly 30% on top of your spend. We boost
          through Meta&rsquo;s ad system directly, so that fee does not apply and more of your budget reaches people.
        </Callout>
      </Section>

      <Section title="Your dashboard">
        <p>
          When you log back in you will see a simple status panel: when we last checked your account, how many posts
          we found, how many we boosted, how many ads are live, and what you have spent this month. Below that is a
          plain-English feed of the last things we did. You do not have to check it. It is there when you are curious.
        </p>
      </Section>

      <Section title="Common questions">
        <Faq
          items={[
            {
              q: "Do I need to do anything day to day?",
              a: "No. Keep posting on Instagram as normal. We handle which posts to put money behind, how much, where, and when to stop. Check the dashboard whenever you fancy, but you do not need to.",
            },
            {
              q: "How long until I see something?",
              a: "Your first boosts usually go live within about fifteen minutes of finishing setup, once Instagram has reviewed the ads. Profile visits and views build over the following days.",
            },
            {
              q: "How much does it cost?",
              a: "Two separate things. Your SuperPulse subscription is £300 a month plus VAT, and your first month is free. Your ad spend is the daily budget you set per location (we suggest around £5 a day each), billed on your own Meta ad account, not by us.",
            },
            {
              q: "Can I pause or stop?",
              a: "Yes. You can change your budget or settings any time. For a full stop, message us and we pause everything. Nothing gets deleted.",
            },
            {
              q: "What about the posts I have already made?",
              a: "We work with the posts on your account, and new ones get picked up automatically as you publish. You do not need to re-upload or change anything.",
            },
            {
              q: "Is my account safe? Will you post for me?",
              a: "We never post on your behalf. We only read your posts and create the ad boosts. You log in through Facebook’s own secure screen, so we never see your password, and we only ever touch your own ad account.",
            },
            {
              q: "Can I change which Instagram or ad account you use?",
              a: "You can switch your page later in Settings. For any other connection change, get in touch and we will sort it.",
            },
            {
              q: "Who do I talk to if I am stuck?",
              a: "Reply to any email from us and a real person gets back to you. There is no bot wall.",
            },
          ]}
        />
      </Section>

      <p className="mt-12 text-sm text-zinc-600">
        On the SuperPulse team? <Link href="/guide/team" className="text-[#1EBA8F] hover:underline">Read the operator guide.</Link>
      </p>
    </article>
  );
}
