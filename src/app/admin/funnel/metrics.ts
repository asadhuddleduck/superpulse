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
  demoOffered: number;
  demoRequested: number;
  demoOptInRate: number;
  recentDemoRequests: {
    email: string;
    name: string;
    businessType: string;
    locations: number;
    requestedAt: string;
  }[];
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
  v8: {
    callVolume15d: number; // toward Meta's 1500-calls/15d App Review threshold
    callSuccessRate: number; // 0-100 (must stay >85 for App Review)
    appUsagePeak: number; // latest x-app-usage peak %, 0 if none
    breakerTrips24h: number;
    pendingIntents: number;
    campaignsActive: number;
    adsetsLive: number;
    adsLive: number;
    provisioning: number; // tenants mid-build
    provisioned: number; // tenants built
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
    `SELECT COUNT(*) total, SUM(qualified) q,
       SUM(CASE WHEN audit_offer_choice='yes' THEN 1 ELSE 0 END) yes,
       SUM(CASE WHEN COALESCE(demo_qualified,0)=1 OR demo_offer_choice IS NOT NULL THEN 1 ELSE 0 END) demo_offered,
       SUM(CASE WHEN demo_requested_at IS NOT NULL THEN 1 ELSE 0 END) demo_requested
     FROM qualifier_responses`,
  );
  const qualifyCompletions = n(qRow.total);
  const qualified = n(qRow.q);
  const auditYes = n(qRow.yes);
  const demoOffered = n(qRow.demo_offered);
  const demoRequested = n(qRow.demo_requested);

  // The DB row is the source of truth on a time-boxed promise ("in touch
  // within a few hours") — a dropped Slack webhook must not become a ghosted
  // lead, so the dashboard lists recent requests for manual follow-up.
  const recentDemoRequests = (
    await rows(
      `SELECT q.email, COALESCE(w.first_name,'') name, COALESCE(q.business_type,'') bt,
         COALESCE(q.locations_count,0) loc, q.demo_requested_at ts
       FROM qualifier_responses q LEFT JOIN waitlist w ON w.email = q.email
       WHERE q.demo_requested_at IS NOT NULL
       ORDER BY q.demo_requested_at DESC LIMIT 10`,
    )
  ).map((r) => ({
    email: String(r.email),
    name: String(r.name),
    businessType: String(r.bt),
    locations: n(r.loc),
    requestedAt: String(r.ts),
  }));

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

  // --- v8 engine live ---
  const cv = await one(
    `SELECT COUNT(*) total, SUM(CASE WHEN status_code>=400 OR error IS NOT NULL THEN 1 ELSE 0 END) errors FROM api_call_log WHERE created_at >= datetime('now','-15 days')`,
  );
  const cvTotal = n(cv.total);
  const cvErrors = n(cv.errors);
  const auRow = await one(
    `SELECT app_usage_json FROM rate_limit_log WHERE app_usage_json IS NOT NULL ORDER BY captured_at DESC LIMIT 1`,
  );
  let appUsagePeak = 0;
  try {
    if (auRow.app_usage_json) {
      const u = JSON.parse(String(auRow.app_usage_json));
      appUsagePeak = Math.max(n(u.call_count), n(u.total_cputime), n(u.total_time));
    }
  } catch {
    appUsagePeak = 0;
  }
  const breakerTrips24h = n(
    (await one(`SELECT COUNT(*) c FROM audit_events WHERE event_type='v8_circuit_breaker_tripped' AND created_at >= datetime('now','-1 day')`)).c,
  );
  const pendingIntents = n((await one(`SELECT COUNT(*) c FROM v8_intents WHERE status='pending'`)).c);
  const campaignsActive = n((await one(`SELECT COUNT(*) c FROM tenant_campaigns WHERE status='ACTIVE'`)).c);
  const adsetsLive = n((await one(`SELECT COUNT(*) c FROM location_adsets WHERE status='ACTIVE'`)).c);
  const adsLive = n((await one(`SELECT COUNT(*) c FROM reel_ads WHERE status='ACTIVE'`)).c);
  const provStates = await rows(
    `SELECT provisioning_status s, COUNT(*) c FROM tenants WHERE provisioning_status IN ('provisioning','provisioned') GROUP BY s`,
  );
  const provMap = new Map(provStates.map((r) => [String(r.s), n(r.c)]));

  return {
    waitlist,
    signupsByDay,
    topSources,
    qualifyCompletions,
    qualified,
    qualifiedRate: pct(qualified, qualifyCompletions),
    auditYesRate: pct(auditYes, qualifyCompletions),
    demoOffered,
    demoRequested,
    demoOptInRate: pct(demoRequested, demoOffered),
    recentDemoRequests,
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
    v8: {
      callVolume15d: cvTotal,
      callSuccessRate: cvTotal === 0 ? 100 : Math.round((1000 * (cvTotal - cvErrors)) / cvTotal) / 10,
      appUsagePeak,
      breakerTrips24h,
      pendingIntents,
      campaignsActive,
      adsetsLive,
      adsLive,
      provisioning: provMap.get("provisioning") ?? 0,
      provisioned: provMap.get("provisioned") ?? 0,
    },
  };
}
