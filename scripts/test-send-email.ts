// Send a couple of the waitlist emails to a test inbox to verify the Resend
// path + real-client rendering. Sends to Asad's own inbox only.
// Run: node --env-file=.env.local --import tsx scripts/test-send-email.ts
import { renderStep, type EmailContext } from "../src/lib/email/templates";
import { sendEmail } from "../src/lib/email/send";

const to = process.env.TEST_TO || "asadshah.co.uk@gmail.com";

const ctx: EmailContext = {
  firstName: "Asad",
  email: to,
  igHandle: "mr.asadshah",
  unsubUrl: "https://www.superpulse.io/api/email/unsubscribe?e=test&t=test",
  joinedDate: "14 May 2026",
};

// Welcome + the audit email (not-bought variant) — the two that carry the CTA.
const picks: Array<{ step: number; bought: boolean }> = [
  { step: 0, bought: false },
  { step: 1, bought: false },
];

async function main() {
  for (const pick of picks) {
    const t = renderStep(pick.step, ctx, pick.bought);
    const r = await sendEmail({ to, subject: `[TEST] ${t.subject}`, html: t.html, unsubUrl: ctx.unsubUrl });
    console.log(`sent step ${pick.step}  id=${r.id}  ${t.subject}`);
    await new Promise((res) => setTimeout(res, 700));
  }
  console.log(`\nDone. Check ${to} (and spam) for 2 emails.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
