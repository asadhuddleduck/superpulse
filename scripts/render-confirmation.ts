// Render + optionally test-send the audit confirmation emails.
// Run: node --env-file=.env.local --import tsx scripts/render-confirmation.ts [--send]
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { auditConfirmationEmail } from "../src/lib/email/confirmation";
import { sendEmail } from "../src/lib/email/send";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", ".email-preview");
mkdirSync(out, { recursive: true });

async function main() {
  const c27 = auditConfirmationEmail("Sam", "audit-27");
  const c97 = auditConfirmationEmail("Sam", "audit-97");
  writeFileSync(join(out, "confirm-27.html"), c27.html);
  writeFileSync(join(out, "confirm-97.html"), c97.html);
  console.log("rendered confirm-27.html + confirm-97.html");
  if (process.argv.includes("--send")) {
    const to = process.env.TEST_TO || "asadshah.co.uk@gmail.com";
    const r = await sendEmail({ to, subject: `[TEST] ${c27.subject}`, html: c27.html });
    console.log(`sent £27 confirmation to ${to}: ${r.id}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
