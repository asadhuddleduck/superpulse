// ---------------------------------------------------------------------------
// SuperPulse waitlist email sequence — templates
// Dark SuperPulse brand. Owner-to-owner UK voice. No "AI" word. No em/en dashes.
// Pure module: no external imports, so the render harness and the live sequence
// engine can both import it. Each template returns { subject, preheader, html }.
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  subject: string;
  preheader: string;
  html: string;
}

export interface EmailContext {
  firstName: string;
  email: string;
  igHandle?: string;
  unsubUrl: string;
  joinedDate: string; // e.g. "14 May 2026" — shown in the recall strip on every email
}

// --- brand tokens ----------------------------------------------------------
// Light theme. Email clients handle dark mode inconsistently, so we build on a
// light base (renders predictably everywhere) and let each client dark-treat it.
const C = {
  pageBg: "#F4F4F6",
  card: "#FFFFFF",
  border: "#E6E6EA",
  yellow: "#F7CE46",
  green: "#0E9C75", // text-safe green on white
  ink: "#15151B", // headlines
  body: "#3C3C45", // body text
  mist: "#73737E", // muted
};
const AUDIT_BASE = "https://www.superpulse.io/waitlist/qualify";
const FONT =
  "Inter,-apple-system,'SF Pro Display','Helvetica Neue',Helvetica,Arial,sans-serif";

function greeting(ctx: EmailContext): string {
  return ctx.firstName ? `Hi ${esc(ctx.firstName)},` : "Hi,";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function auditUrl(ctx: EmailContext, campaign: string): string {
  const q = new URLSearchParams({
    email: ctx.email,
    name: ctx.firstName || "",
    utm_source: "email",
    utm_medium: "nurture",
    utm_campaign: campaign,
  });
  if (ctx.igHandle) q.set("ig", ctx.igHandle);
  return `${AUDIT_BASE}?${q.toString()}`;
}

// --- html helpers (each returns a <tr> row unless noted) -------------------
function h(text: string): string {
  return `<tr><td align="left" style="padding:0 0 18px;">
  <h1 style="margin:0;font-size:26px;font-weight:800;color:${C.ink};line-height:1.28;letter-spacing:-0.02em;">${text}</h1>
</td></tr>`;
}

function p(text: string, pb = 16): string {
  return `<p style="margin:0 0 ${pb}px;font-size:16px;color:${C.body};line-height:1.6;">${text}</p>`;
}

function block(paras: string[]): string {
  const inner = paras
    .map((t, i) => p(t, i < paras.length - 1 ? 16 : 0))
    .join("\n  ");
  return `<tr><td style="padding:0 0 22px;">\n  ${inner}\n</td></tr>`;
}

function card(title: string, desc: string): string {
  return `<tr><td style="padding:0 0 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-left:3px solid ${C.yellow};border-radius:12px;">
  <tr><td style="padding:18px 22px;">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${C.ink};line-height:1.4;">${title}</p>
    <p style="margin:0;font-size:15px;color:${C.mist};line-height:1.55;">${desc}</p>
  </td></tr>
  </table>
</td></tr>`;
}

function numCard(n: number, title: string, desc: string): string {
  return `<tr><td style="padding:0 0 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;">
  <tr><td style="padding:18px 22px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="34" valign="top" style="padding-right:14px;">
        <div style="width:34px;height:34px;border-radius:8px;background:${C.yellow};text-align:center;line-height:34px;font-size:15px;font-weight:800;color:${C.ink};">${n}</div>
      </td>
      <td valign="top">
        <p style="margin:0 0 5px;font-size:16px;font-weight:700;color:${C.ink};line-height:1.4;">${title}</p>
        <p style="margin:0;font-size:15px;color:${C.mist};line-height:1.55;">${desc}</p>
      </td>
    </tr></table>
  </td></tr>
  </table>
</td></tr>`;
}

function btn(text: string, url: string): string {
  return `<tr><td align="left" style="padding:8px 0 28px;">
  <a href="${url}" style="display:inline-block;padding:14px 30px;background:${C.yellow};color:${C.ink};font-size:16px;font-weight:800;text-decoration:none;border-radius:8px;">${text}</a>
</td></tr>`;
}

function ps(text: string): string {
  return `<tr><td style="padding:0 0 8px;">
  <p style="margin:0;font-size:14px;color:${C.mist};line-height:1.55;">PS: ${text}</p>
</td></tr>`;
}

const g = (n: string) => `<span style="color:${C.green};font-weight:700;">${n}</span>`;

function wrap(bodyRows: string, preheader: string, ctx: EmailContext): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light only"/>
<title>SuperPulse</title>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${FONT};color:${C.body};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};">
<tr><td align="center" style="padding:36px 16px 56px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td align="left" style="padding:0 0 12px;">
  <span style="font-size:15px;color:${C.yellow};">&#9889;</span>
  <span style="font-size:21px;font-weight:800;color:${C.ink};letter-spacing:-0.02em;vertical-align:middle;">SuperPulse</span>
</td></tr>

<tr><td align="left" style="padding:0 0 28px;">
  <p style="margin:0;font-size:12px;color:${C.mist};line-height:1.5;">You joined the SuperPulse waitlist on <span style="color:${C.ink};">${esc(ctx.joinedDate)}</span> after finding us on Instagram (@mr.asadshah).</p>
</td></tr>

${bodyRows}

<tr><td style="padding:8px 0 22px;"><div style="height:1px;background:${C.border};"></div></td></tr>

<tr><td style="padding:0 0 22px;">
  <p style="margin:0;font-size:15px;color:${C.body};line-height:1.5;">Asad</p>
  <p style="margin:4px 0 0;font-size:13px;color:${C.mist};">SuperPulse by Huddle Duck</p>
</td></tr>

<tr><td style="padding:0;">
  <p style="margin:0 0 8px;font-size:12px;color:${C.mist};line-height:1.55;">
    SuperPulse boosts your best Instagram posts to the locals near your business, automatically, so people who've never heard of you actually walk in. You're on the waitlist for early access.
  </p>
  <p style="margin:0;font-size:12px;color:${C.mist};line-height:1.55;">
    Not for you? <a href="${ctx.unsubUrl}" style="color:${C.mist};text-decoration:underline;">Unsubscribe</a> and I won't email again.
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Step 0 — Welcome (immediate)
// ---------------------------------------------------------------------------
function welcome(ctx: EmailContext): EmailTemplate {
  const pre = "You're on the list. Here's what happens next.";
  const body =
    h("You're on the list") +
    block([
      `${greeting(ctx)}`,
      `You're in. Good move.`,
      `The short version of what we do: you post on Instagram like normal. We take your best posts and put them in front of the people who live near your business, the ones who could actually walk in. You never touch ad settings, budgets or targeting. We handle all of it.`,
      `One of our chains gets profile visits for about ${g("7p each")}. That's the cheapest local advertising we've ever measured.`,
      `We open spots in waves, so you won't be waiting forever. While the seats fill up, there's one useful thing you can do today.`,
      `For £27 we'll go through your whole Instagram, your profile, bio, highlights, pinned posts and reels, and show you exactly what's stopping followers from turning into paying customers. It's the same review we run on every business before we switch them on.`,
    ]) +
    btn("Get my £27 audit", auditUrl(ctx, "welcome")) +
    block([
      `No pressure at all. Even if you never spend another penny, you'll know more about your local reach than most owners on your street.`,
      `Talk soon,<br/>Asad`,
    ]) +
    ps(`I read every reply. Hit reply and tell me what you run. I'm nosey about local businesses.`);
  return { subject: "You're on the SuperPulse list", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 1 — Audit email (+3d) — branches on boughtAudit
// ---------------------------------------------------------------------------
function auditNotBought(ctx: EmailContext): EmailTemplate {
  const pre = "Your £27 Instagram audit, in plain English.";
  const body =
    h("What we'd fix first") +
    block([
      `${greeting(ctx)}`,
      `Getting someone onto your Instagram is one thing. Turning them into someone who actually books, orders or walks in is another. That second part lives on your profile, and it's where most local businesses quietly lose people they worked hard to get.`,
      `The £27 audit goes through your whole Instagram and tells you what to fix. We look at:`,
    ]) +
    card("Your profile", "Your photo, bio and link in bio. The three seconds that decide whether a stranger stays or scrolls off.") +
    card("Your shopfront", "Your highlights and pinned posts and reels. What a new visitor sees first, and whether it makes them want in.") +
    card("Your reels", "Your reels themselves, down to the hook and the call to action in each. Where attention is won or lost in the first second.") +
    block([`Every note is judged against one thing: turning followers into actual sales. You get it back as a clean written PDF. No call required, no upsell wall.`]) +
    btn("Get my £27 audit", auditUrl(ctx, "audit-push")) +
    block([`If you've got questions first, just reply.<br/>Asad`]) +
    ps(`We've done this across ${g("hundreds of local businesses")} now. The pattern's almost always the same: great business, profile leaking the customers it worked hard to win.`);
  return { subject: "The 5-minute version of what we'd fix first", preheader: pre, html: wrap(body, pre, ctx) };
}

function auditBought(ctx: EmailContext): EmailTemplate {
  const pre = "What's coming, and how to use it.";
  const body =
    h("Your audit, and how to use it") +
    block([
      `${greeting(ctx)}`,
      `Thanks for grabbing the audit. Here's what's coming and how to get the most from it.`,
      `You'll get a clean PDF that goes through your Instagram piece by piece: your profile photo, bio and link, your highlights, your pinned posts and reels, and your reels themselves, right down to the hook and the call to action in each.`,
      `Every note points at one outcome: turning the followers you've already got into people who actually book, order or walk in.`,
      `When it lands, two things to keep in mind:`,
    ]) +
    card("Read it top to bottom", "We order it on purpose. The quickest wins are usually right at the top.") +
    card("Start with the profile", "Your photo, bio and link do the most work for the least effort. Fix those first.") +
    block([
      `You don't need to action all of it yourself. When your spot opens, we'll already know exactly what to tighten before we send anyone your way.`,
      `Anything not clear? Reply and I'll explain it properly.<br/>Asad`,
    ]) +
    ps(`You're near the front of the queue now. I'll be in touch the moment a seat opens.`);
  return { subject: "Your audit, and how to use it", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 2 — Nurture W1 (+10d) — "invisible" — light branch
// ---------------------------------------------------------------------------
function nurtureInvisible(ctx: EmailContext, boughtAudit: boolean): EmailTemplate {
  const pre = "Posting isn't the same as being seen.";
  const tail = boughtAudit
    ? block([`One more thing. Getting people onto your profile only pays off if the profile's ready for them. You've got the audit, so you'll already know which bits to tighten first. Worth a read when it lands.<br/>Asad`])
    : block([
        `One more thing. Boosting your best post only pays off if your profile's ready for the visitors it brings. The £27 audit goes through your bio, highlights, pinned content and reels and tells you exactly what to fix first.`,
      ]) +
      btn("See the audit", auditUrl(ctx, "w1-invisible")) +
      block([`Asad`]);
  const body =
    h("Why good local businesses stay invisible") +
    block([
      `${greeting(ctx)}`,
      `Most owners find this out too late. Instagram shows your posts to a slice of your followers and almost nobody else. Post every day and you're still talking to the same small room.`,
      `The people you actually want, the ones who live ten minutes away and have never heard of you, don't follow you yet. So they never see a thing.`,
      `That's the whole problem in one line: your reach is capped at people who already know you.`,
      `Boosting fixes it by putting one good post in front of nearby strangers, the people on your street who don't follow you yet.`,
      `One easy thing you can do now: open your insights and find the post with the most saves and shares in the last month. Saves and shares mean people thought "I'd go there." That's usually the post worth money.`,
    ]) +
    tail;
  return { subject: "Why good local businesses stay invisible", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 3 — Nurture W2 (+17d) — proof
// ---------------------------------------------------------------------------
function nurtureProof1(ctx: EmailContext): EmailTemplate {
  const pre = "What boosting did for an 18-shop chain.";
  const body =
    h("One post. Eighteen shops. Local people walking in.") +
    block([
      `${greeting(ctx)}`,
      `A real one for you.`,
      `We run a burger chain with 18 locations. Same idea as yours, just more sites. They post on Instagram like anyone else.`,
      `We take those posts and push them to people near each shop. Last count: over ${g("a million local impressions")} in a month, profile visits at about ${g("7p each")}, and a ${g("£2.18")} cost to reach a thousand people.`,
      `For a local business those numbers are unusual. Reaching a thousand nearby people for the price of a coffee is the kind of maths that actually moves footfall.`,
      `The part worth remembering: they didn't make new content for this. We used posts they'd already made. The work was already done. It just wasn't being seen.`,
      `Asad`,
    ]) +
    ps(`${g("6 businesses")} on this, zero have left. Make of that what you will.`);
  return { subject: "What boosting did for an 18-shop chain", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 4 — Nurture W3 (+24d) — tip: which posts
// ---------------------------------------------------------------------------
function nurturePostsTip(ctx: EmailContext): EmailTemplate {
  const pre = "And the ones that quietly waste it.";
  const body =
    h("The three posts worth putting money behind") +
    block([
      `${greeting(ctx)}`,
      `Not every post deserves a budget. Put money behind the wrong one and you've paid to show strangers something that doesn't sell you.`,
      `Three that usually work:`,
    ]) +
    numCard(1, "The mouthwatering one", "The shot people screenshot. For a salon that's the before and after. For a gym it's the transformation. For a takeaway it's the close-up.") +
    numCard(2, "The proof one", "A busy Saturday, a queue out the door, a wall of five-star reviews. Strangers trust other locals.") +
    numCard(3, "The offer one", "A clear reason to come this week, not someday.") +
    block([
      `Three to skip: blurry phone snaps, anything with text nobody can read on a small screen, and reposts of someone else's content.`,
      `You don't have to guess which of yours fit. That's the judgement we make for you, every time you post.<br/>Asad`,
    ]);
  return { subject: "The 3 posts worth putting money behind", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 5 — Nurture W4 (+31d) — build-in-public: how we pick
// ---------------------------------------------------------------------------
function nurtureHowWePick(ctx: EmailContext): EmailTemplate {
  const pre = "A look under the bonnet.";
  const body =
    h("How we pick what to boost, without you lifting a finger") +
    block([
      `${greeting(ctx)}`,
      `People ask how we decide what to put money behind. Here's the honest version.`,
      `Every time you post, our system looks at it within the hour. It checks how people reacted in the first stretch: saves, shares, comments, how long they watched. Strong early signal means real people liked it, not a fluke.`,
      `It checks the post is even eligible to run as an ad. Music rights trip a lot of businesses up here. Then it puts a small budget behind the winners and points them at people near you.`,
      `If something's working, it leans in. If it's not, it stops, so you're never bleeding money on a dud.`,
      `The point of all this: you keep posting like normal and the right posts quietly turn into local ads. No dashboards to learn, no settings to fiddle with.<br/>Asad`,
    ]) +
    ps(`We're rebuilding this engine right now to make the budgeting even sharper. That's part of what you're on the list for.`);
  return { subject: "How we pick what to boost (without you lifting a finger)", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 6 — Nurture W5 (+38d) — tip: radius
// ---------------------------------------------------------------------------
function nurtureRadius(ctx: EmailContext): EmailTemplate {
  const pre = "A bit on radius, in plain terms.";
  const body =
    h("The people worth reaching live closer than you think") +
    block([
      `${greeting(ctx)}`,
      `Most local businesses live or die on a small patch. A few miles, sometimes less. The person who becomes a regular usually lives or works close enough to pop in without planning it.`,
      `So when we boost a post, we don't spray it across the whole city. We draw a tight ring around your business and spend inside it. Every penny goes to someone who could realistically walk through your door.`,
      `Spend wide and your numbers look big while your tills stay quiet. Spend tight and local, and the visits turn into faces you start to recognise.`,
      `If you've got more than one location, each one gets its own ring. The post that does well in one area runs there, not somewhere it means nothing.<br/>Asad`,
    ]);
  return { subject: "The people worth reaching live closer than you think", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 7 — Nurture W6 (+45d) — proof + commission framing
// ---------------------------------------------------------------------------
function nurtureCommission(ctx: EmailContext): EmailTemplate {
  const pre = "Compare it to what the apps take.";
  const body =
    h("What a local visit should actually cost you") +
    block([
      `${greeting(ctx)}`,
      `Let's talk money for a second.`,
      `If you're on the delivery apps, you know the cut. Roughly a third of every order, gone, on food you cooked and a customer they often introduced you to once and then own forever.`,
      `Now the other side. We get nearby people onto a business's profile for about ${g("7p a visit")}. Some of those follow. Some come in. The ones who come in are yours, not rented from a platform that bills you on every future order.`,
      `We're all for spending to get seen locally. It's the most sensible money a small shop can put out. What stings is handing a third of your takings to an app for the privilege.`,
      `Owning your local audience costs pennies. Renting customers costs a third, forever.<br/>Asad`,
    ]);
  return { subject: "What a local visit should actually cost you", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 8 — Nurture W7 (+52d) — tip: convert to walk-ins
// ---------------------------------------------------------------------------
function nurtureConvert(ctx: EmailContext): EmailTemplate {
  const pre = "The bit most boosted posts get wrong.";
  const body =
    h("Turning a scroll into someone at the counter") +
    block([
      `${greeting(ctx)}`,
      `Getting seen is half of it. The other half is giving a stranger a reason to actually move.`,
      `A boosted post that just looks nice gets a like and a scroll past. A boosted post with a clear, easy next step gets a visit.`,
      `Three things that nudge people off the sofa:`,
    ]) +
    numCard(1, "A reason to come now", "This weekend. While it's on. First 20 people. Urgency that's real, not made up.") +
    numCard(2, "A dead-simple action", "Show this post for a free side. Walk in, no booking. Don't make them think.") +
    numCard(3, "Where you are", "Drop the area in the caption. Locals scan for is-this-near-me before anything else.") +
    block([`You write the post. We make sure the right locals see it. Between the two, you get footfall.<br/>Asad`]);
  return { subject: "Turning a scroll into someone at the counter", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 9 — Nurture W8 (+59d) — build-in-public: roadmap
// ---------------------------------------------------------------------------
function nurtureRoadmap(ctx: EmailContext): EmailTemplate {
  const pre = "A straight update from the workshop.";
  const body =
    h("What we're building for you right now") +
    block([
      `${greeting(ctx)}`,
      `An insider update, since you're on the list.`,
      `We're heads-down on the next version of SuperPulse. The big upgrade is smarter budgeting across your posts and locations, so the money flows to whatever's working that week without anyone babysitting it.`,
      `We're also tightening the part that decides when to stop an ad that isn't pulling its weight, so you never waste a day's spend on something flat.`,
      `Why it matters to you: by the time your seat opens, the thing switching on is sharper than what we ran six months ago. And that already got profile visits down to ${g("7p")}.`,
      `We open spots carefully so the early businesses get proper attention. That's why the list exists, and why you're not stuck in some endless queue.<br/>Asad`,
    ]) +
    ps(`Anything you wish a tool like this did? Reply and tell me. We're still shaping it.`);
  return { subject: "What we're building for you right now", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 10 — Nurture W9 (+66d) — myth-busting
// ---------------------------------------------------------------------------
function nurtureMargin(ctx: EmailContext): EmailTemplate {
  const pre = "The honest answer to the question every owner asks.";
  const body =
    h("&quot;Won't this just eat my margin?&quot;") +
    block([
      `${greeting(ctx)}`,
      `It's the question we get most, so here's the straight answer.`,
      `The fear: I put money into ads, it disappears, my margin's thinner and I've nothing to show for it. Fair fear. Most owners have been burned by an agency or a boosted post that went nowhere.`,
      `The difference is where the money goes and whether it stops. We spend small, locally, on posts that already proved people like them. If a post isn't earning its keep, the spend stops on its own. You're not signing up to pour cash at the wall and hope.`,
      `And the comparison that matters: a profile visit at ${g("7p")}, against a third of every delivery order forever. One of those eats your margin. It isn't the 7p one.`,
      `Done right, local ads are simply how the people nearby finally find the thing you're already good at.<br/>Asad`,
    ]);
  return { subject: "\"Won't this just eat my margin?\"", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Step 11 — Nurture W10 (+73d) — the bridge
// ---------------------------------------------------------------------------
function nurtureBridge(ctx: EmailContext): EmailTemplate {
  const pre = "The product's close. Here's how to be ready.";
  const body =
    h("Where things stand, and your first step") +
    block([
      `${greeting(ctx)}`,
      `You've been on the list a little while now, so here's where we're at.`,
      `SuperPulse is close. We're finishing the new version and opening seats in small waves so the early businesses get looked after properly. You're on that list, which means you're ahead of the cold crowd when we switch the next batch on.`,
      `One thing makes your first month land faster: a profile that's ready to turn visitors into customers before we send anyone to it. That's what the £27 audit sorts. We go through your whole Instagram, from your bio to your reels, and tell you exactly what to fix. It's the same review we run on every business before we go live, and it's yours whether you ever subscribe or not.`,
    ]) +
    btn("Get my £27 audit", auditUrl(ctx, "w10-bridge")) +
    block([
      `Or just reply and tell me about your business. What you run, where you are, what a good week looks like. When your seat opens, I'll already know your setup.`,
      `Either way, I'm glad you're here.<br/>Asad`,
    ]) +
    ps(`Same promise as day one. We get nearby people onto your profile for pennies, using posts you've already made. The waiting's nearly over.`);
  return { subject: "Where things stand, and your first step", preheader: pre, html: wrap(body, pre, ctx) };
}

// ---------------------------------------------------------------------------
// Schedule + resolver — shared by the render harness and the live engine
// ---------------------------------------------------------------------------
export interface StepDef {
  step: number;
  offsetDays: number;
  key: string;
  branches: boolean; // does the copy differ by boughtAudit?
}

export const STEPS: StepDef[] = [
  { step: 0, offsetDays: 0, key: "welcome", branches: false },
  { step: 1, offsetDays: 3, key: "audit", branches: true },
  { step: 2, offsetDays: 10, key: "invisible", branches: true },
  { step: 3, offsetDays: 17, key: "proof-18shops", branches: false },
  { step: 4, offsetDays: 24, key: "posts-tip", branches: false },
  { step: 5, offsetDays: 31, key: "how-we-pick", branches: false },
  { step: 6, offsetDays: 38, key: "radius", branches: false },
  { step: 7, offsetDays: 45, key: "commission", branches: false },
  { step: 8, offsetDays: 52, key: "convert", branches: false },
  { step: 9, offsetDays: 59, key: "roadmap", branches: false },
  { step: 10, offsetDays: 66, key: "margin", branches: false },
  { step: 11, offsetDays: 73, key: "bridge", branches: false },
];

export const LAST_STEP = STEPS[STEPS.length - 1].step;

export function renderStep(
  step: number,
  ctx: EmailContext,
  boughtAudit: boolean,
): EmailTemplate {
  switch (step) {
    case 0:
      return welcome(ctx);
    case 1:
      return boughtAudit ? auditBought(ctx) : auditNotBought(ctx);
    case 2:
      return nurtureInvisible(ctx, boughtAudit);
    case 3:
      return nurtureProof1(ctx);
    case 4:
      return nurturePostsTip(ctx);
    case 5:
      return nurtureHowWePick(ctx);
    case 6:
      return nurtureRadius(ctx);
    case 7:
      return nurtureCommission(ctx);
    case 8:
      return nurtureConvert(ctx);
    case 9:
      return nurtureRoadmap(ctx);
    case 10:
      return nurtureMargin(ctx);
    case 11:
      return nurtureBridge(ctx);
    default:
      throw new Error(`No template for step ${step}`);
  }
}
