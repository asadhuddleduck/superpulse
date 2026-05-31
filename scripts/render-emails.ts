// Render the waitlist email sequence to static HTML for review.
// Run: npx tsx scripts/render-emails.ts
// Output: .email-preview/<step>-<variant>.html + .email-preview/index.html (contact sheet)
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { STEPS, renderStep, type EmailContext } from "../src/lib/email/templates";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".email-preview");
mkdirSync(outDir, { recursive: true });

const ctx: EmailContext = {
  firstName: "Sam",
  email: "sam@example.com",
  igHandle: "sams_kitchen",
  unsubUrl: "#unsubscribe",
  joinedDate: "14 May 2026",
};

type Rendered = { file: string; step: number; variant: string; subject: string; preheader: string; html: string };
const all: Rendered[] = [];

for (const s of STEPS) {
  const variants: { name: string; bought: boolean }[] = s.branches
    ? [
        { name: "not-bought", bought: false },
        { name: "bought", bought: true },
      ]
    : [{ name: "default", bought: false }];
  for (const v of variants) {
    const t = renderStep(s.step, ctx, v.bought);
    const file = `${String(s.step).padStart(2, "0")}-${s.key}-${v.name}.html`;
    writeFileSync(join(outDir, file), t.html, "utf-8");
    all.push({ file, step: s.step, variant: v.name, subject: t.subject, preheader: t.preheader, html: t.html });
  }
}

// Contact sheet: every email in a phone-width frame, labelled, auto-sized.
const sections = all
  .map((r, i) => {
    const label =
      r.variant === "default"
        ? `Step ${r.step}`
        : `Step ${r.step} — ${r.variant === "bought" ? "bought audit" : "not bought"}`;
    const srcdoc = r.html.replace(/"/g, "&quot;");
    return `<section style="margin:0 0 44px;">
  <div style="max-width:600px;margin:0 auto 10px;">
    <div style="font:600 12px/1.4 ui-monospace,monospace;color:#1EBA8F;letter-spacing:.04em;text-transform:uppercase;">${label}</div>
    <div style="font:700 17px/1.4 Inter,system-ui,sans-serif;color:#F0F0F5;margin-top:4px;">${escapeHtml(r.subject)}</div>
    <div style="font:400 13px/1.4 Inter,system-ui,sans-serif;color:#8888A0;margin-top:2px;">${escapeHtml(r.preheader)}</div>
  </div>
  <iframe id="f${i}" srcdoc="${srcdoc}" width="600" scrolling="no" style="display:block;margin:0 auto;border:1px solid #1E1E26;border-radius:14px;width:600px;height:900px;background:#050508;" onload="this.style.height=(this.contentWindow.document.body.scrollHeight+8)+'px';"></iframe>
</section>`;
  })
  .join("\n");

const index = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SuperPulse waitlist emails — review</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:40px 16px 80px;background:#0c0c10;">
<div style="max-width:600px;margin:0 auto 36px;">
  <div style="font:800 24px/1.2 Inter,system-ui,sans-serif;color:#F0F0F5;">SuperPulse waitlist sequence</div>
  <div style="font:400 14px/1.5 Inter,system-ui,sans-serif;color:#8888A0;margin-top:8px;">12 emails. Day 0 welcome, day 3 audit branch, then weekly nurture (weeks 1 to 10). Steps 1 and 2 show both branch variants. Sample name: Sam.</div>
</div>
${sections}
</body></html>`;
writeFileSync(join(outDir, "index.html"), index, "utf-8");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

console.log(`Rendered ${all.length} emails to ${outDir}`);
for (const r of all) console.log(`  ${r.file}  —  ${r.subject}`);
console.log(`\nContact sheet: ${join(outDir, "index.html")}`);
