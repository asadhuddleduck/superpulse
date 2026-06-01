// Live funnel metrics for the internal dashboard. Each query is wrapped so a
// missing table never breaks the page. Queries vetted against schema.sql.
import { db } from "@/lib/db";

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const pct = (a: number, b: number): number => (b > 0 ? Math.round((1000 * a) / b) / 10 : 0);

async function rows(sql: string): Promise<Record<string, unknown>[]> {
  try {
    const r = await db.execute(sql);
    return r.rows as unknown as Record<string, unknown>[];
  } catch {
    return [];
  }
}
async function one(sql: string): Promise<Record<string, unknown>> {
  return (await rows(sql))[0] ?? {};
}

export interface FunnelMetrics {
  waitlist: number;
  signupsByDay: { day: string; count: number }[];
  topSources: { source: string; count: number }[];
  qualifyCompletions: number;
  qualified: number;
  qualifiedRate: number;
  auditYesRate: number;
  audit27: number;
  audit27Revenue: number;
  audit97: number;
  audit97Revenue: number;
  attachRate: number;
  anyAuditBuyers: number;
  monetisationRate: number;
  activeSubs: number;
  newPaying: number;
  legacySubs: number;
  mrr: number;
  onboardingStages: { stage: string; count: number }[];
  emailSent: number;
  emailErrors: number;
  emailByStep: { step: number; sent: number }[];
  positions: { position: number; count: number }[];
  unsubs: number;
  enrolled: number;
  completions: number;
  conv: {
    waitlistToQualify: number;
    qualifyToQualified: number;
    qualifyTo27: number;
    a27To97: number;
    waitlistToAudit: number;
    auditToSub: number;
  };
}

export async function getFunnelMetrics(): Promise<FunnelMetrics> {
  const waitlist = n((await one(`SELECT COUNT(*) c FROM waitlist WHERE source!='healthcheck'`)).c);

  const signupsByDay = (
    await rows(
      `SELECT substr(created_at,1,10) day, COUNT(*) c FROM waitlist WHERE source!='healthcheck' GROUP BY day ORDER BY day DESC LIMIT 10`,
    )
  ).map((r) => ({ day: String(r.day), count: n(r.c) }));

  const topSources = (
    await rows(
      `SELECT COALESCE(utm_campaign, source, '(direct)') src, COUNT(*) c FROM waitlist WHERE source!='healthcheck' GROUP BY src ORDER BY c DESC LIMIT 6`,
    )
  ).map((r) => ({ source: String(r.src), count: n(r.c) }));

  const qRow = await one(
    `SELECT COUNT(*) total, SUM(qualified) q, SUM(CASE WHEN audit_offer_choice='yes' THEN 1 ELSE 0 END) yes FROM qualifier_responses`,
  );
  const qualifyCompletions = n(qRow.total);
  const qualified = n(qRow.q);
  const auditYes = n(qRow.yes);

  const a27 = await one(
    `SELECT COUNT(*) c, COALESCE(SUM(amount_total),0) g FROM audit_purchases WHERE tier='audit-27' AND refunded=0`,
  );
  const a97 = await one(
    `SELECT COUNT(*) c, COALESCE(SUM(amount_total),0) g FROM audit_purchases WHERE tier='audit-97' AND refunded=0`,
  );
  const audit27 = n(a27.c);
  const audit97 = n(a97.c);

  const anyAuditBuyers = n(
    (await one(`SELECT COUNT(DISTINCT lower(email)) c FROM audit_purchases WHERE refunded=0 AND email<>''`)).c,
  );

  const subRow = await one(
    `SELECT SUM(CASE WHEN COALESCE(legacy,0)=0 THEN 1 ELSE 0 END) np, SUM(CASE WHEN COALESCE(legacy,0)=1 THEN 1 ELSE 0 END) lg, COUNT(*) total FROM tenants WHERE subscription_status IN ('active','trialing')`,
  );
  const newPaying = n(subRow.np);
  const legacySubs = n(subRow.lg);
  const activeSubs = n(subRow.total);
  const mrr = newPaying * 300 + legacySubs * 297;

  const onboardingStages = (
    await rows(
      `SELECT COALESCE(status,'(none)') stage, COUNT(*) c FROM tenants WHERE subscription_status IN ('active','trialing') AND COALESCE(legacy,0)=0 GROUP BY stage`,
    )
  ).map((r) => ({ stage: String(r.stage), count: n(r.c) }));

  const auditToSubRow = await one(
    `WITH ae AS (SELECT DISTINCT lower(email) email FROM audit_purchases WHERE refunded=0 AND email<>'')
     SELECT COUNT(DISTINCT lower(t.email)) c FROM tenants t JOIN ae ON lower(t.email)=ae.email WHERE t.subscription_status IN ('active','trialing')`,
  );
  const auditToSub = n(auditToSubRow.c);

  const emailTot = await one(
    `SELECT SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) sent, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) err FROM email_sends`,
  );
  const emailByStep = (
    await rows(`SELECT step, COUNT(*) c FROM email_sends WHERE status='sent' GROUP BY step ORDER BY step`)
  ).map((r) => ({ step: n(r.step), sent: n(r.c) }));
  const positions = (
    await rows(`SELECT position, COUNT(*) c FROM email_sequence_state GROUP BY position ORDER BY position`)
  ).map((r) => ({ position: n(r.position), count: n(r.c) }));
  const unsubs = n((await one(`SELECT COUNT(*) c FROM email_unsubscribes`)).c);
  const enrolled = n((await one(`SELECT COUNT(*) c FROM email_sequence_state`)).c);
  const completions = n((await one(`SELECT COUNT(*) c FROM email_sequence_state WHERE status='completed'`)).c);

  return {
    waitlist,
    signupsByDay,
    topSources,
    qualifyCompletions,
    qualified,
    qualifiedRate: pct(qualified, qualifyCompletions),
    auditYesRate: pct(auditYes, qualifyCompletions),
    audit27,
    audit27Revenue: n(a27.g) / 100,
    audit97,
    audit97Revenue: n(a97.g) / 100,
    attachRate: pct(audit97, audit27),
    anyAuditBuyers,
    monetisationRate: pct(anyAuditBuyers, waitlist),
    activeSubs,
    newPaying,
    legacySubs,
    mrr,
    onboardingStages,
    emailSent: n(emailTot.sent),
    emailErrors: n(emailTot.err),
    emailByStep,
    positions,
    unsubs,
    enrolled,
    completions,
    conv: {
      waitlistToQualify: pct(qualifyCompletions, waitlist),
      qualifyToQualified: pct(qualified, qualifyCompletions),
      qualifyTo27: pct(audit27, qualifyCompletions),
      a27To97: pct(audit97, audit27),
      waitlistToAudit: pct(anyAuditBuyers, waitlist),
      auditToSub: pct(auditToSub, anyAuditBuyers),
    },
  };
}
