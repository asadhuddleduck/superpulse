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
        sub="SuperPulse takes the posts you already put on Instagram and runs them as local ads, so more people nearby see you. You set it up once, then leave it running. Here is the whole thing, start to finish."
      />

      <Section title="Setup, step by step">
        <Steps>
          <Step n={1} title="Log in with Instagram" see="A Facebook permission screen, then your account is connected.">
            <p>
              Tap the login button and sign in through Facebook. We ask through Facebook because that is the only
              way to run proper ads from your posts. Your password stays with Facebook, we never see it.
            </p>
          </Step>
          <Step n={2} title="Pick your page" see="A short list, only if you manage more than one.">
            <p>
              If your account looks after a few Instagram pages, choose the one this is for. If you only have one,
              we skip straight past this.
            </p>
          </Step>
          <Step n={3} title="Choose the ad account" see="Your ad accounts, with the right one ready to confirm.">
            <p>Pick the ad account the spend should come from. One tap and you are through.</p>
          </Step>
          <Step n={4} title="Tell us where you are" see="A box to type your locations, then a tick once we find them.">
            <p>
              Type your shop address or postcode (one line per location if you have more than one). This sets the
              area around each spot that your ads reach, so your budget only goes to people who could actually walk in.
            </p>
          </Step>
          <Step n={5} title="Set your budget" see="A simple daily amount per location.">
            <p>
              Choose a daily budget per location. Most owners start around £5 a day each. You can change it any time,
              and your first month is on us.
            </p>
          </Step>
          <Step n={6} title="That is it, you are live" see="A short ‘setting things up’ screen, then your dashboard.">
            <p>
              We start working straight away. Your first boosts usually go out within about fifteen minutes, and we
              email you once they are live. You can close the tab, nothing else is needed from you.
            </p>
          </Step>
        </Steps>
      </Section>

      <Section title="What SuperPulse does once you are set up">
        <p>
          Every time you post on Instagram, we look at it and decide whether it is worth putting behind a local ad.
          For the ones that are, we set the budget, pick the area, run them, watch how they do, and quietly stop the
          ones that are not pulling their weight. All of it happens in the background, day and night.
        </p>
        <p>
          The aim is simple: more of the right local people seeing you, following you, and walking in. You keep
          posting like you always have. We do the rest.
        </p>
        <Callout>
          Boosting this way skips the roughly 30% extra you pay when you boost inside the Instagram app, so more of
          your budget goes to actually reaching people.
        </Callout>
      </Section>

      <Section title="Your dashboard">
        <p>
          When you log back in you will see a simple status panel: when we last checked your posts, how many we have
          boosted, how many ads are live, and what you have spent. Below that is a short feed of what has happened
          recently. You do not have to check it. It is there when you are curious.
        </p>
      </Section>

      <Section title="Common questions">
        <Faq
          items={[
            {
              q: "Do I need to do anything after setup?",
              a: "No. Keep posting on Instagram as normal. We handle which posts to put money behind, how much, where, and when to stop.",
            },
            {
              q: "How long until I see something?",
              a: "First boosts usually go out within about fifteen minutes of finishing setup. Followers and profile visits tend to move first, over the following days.",
            },
            {
              q: "How much does it cost?",
              a: "£300 a month plus VAT, and your first month is free. Your ad budget is separate and set by you (most owners start around £5 a day per location). You stay in control of the spend.",
            },
            {
              q: "Can I pause or stop?",
              a: "Yes. Message us any time and we can pause everything or stop it. Nothing is locked in.",
            },
            {
              q: "What about the posts I have already made?",
              a: "Those count too. We look at what you post going forward and put the strongest ones to work locally.",
            },
            {
              q: "Is my account safe?",
              a: "Yes. You log in through Facebook, so we never see your password, and we only ever touch your own ad account. We never post on your behalf.",
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
