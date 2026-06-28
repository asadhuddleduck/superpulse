import { getFunnelMetrics } from "./metrics";
import { FUNNEL, APP_JOURNEY, WEBHOOK_NOTE, NOT_SUPERPULSE } from "./data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Operator auth is enforced upstream by middleware.ts (sp_hq gate) and the
// (console) layout's requireHqUser() — the authoritative validator. No
// page-level gate here: the old ADMIN_DASH_KEY/sp_admin cookie check 404'd the
// page for session-authenticated operators (who never get that cookie).

const YELLOW = "#F7CE46";
const GREEN = "#1EBA8F";

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: accent || "#F0F0F5" }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="text-neutral-600">↓</div>
      <div className="max-w-md text-center text-xs text-neutral-500">{label}</div>
    </div>
  );
}

export default async function FunnelDashboard() {
  const m = await getFunnelMetrics();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 text-neutral-200">
      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span style={{ color: YELLOW }}>&#9889;</span>
          <h1 className="text-xl font-extrabold text-white">SuperPulse — Funnel Map &amp; Insights</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          What&apos;s actually live: every page in the customer journey, the copy, what happens at each step, and the
          live numbers. Read-only. This page fires no tracking, so looking here never touches your pixels or insights.
        </p>
      </header>

      {/* KPIs */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="On the waitlist" value={String(m.waitlist)} sub="from ads" />
        <Kpi label="Did the quiz" value={`${m.qualifyCompletions}`} sub={`${m.conv.waitlistToQualify}% of waitlist`} />
        <Kpi label="Qualified" value={`${m.qualified}`} sub={`${m.qualifiedRate}% of quiz`} />
        <Kpi
          label="Calls booked"
          value={`${m.callsBooked}`}
          sub={`${m.demoRequested} requested · ${m.demoOptInRate}% opt-in`}
          accent={m.callsBooked ? GREEN : undefined}
        />
        <Kpi label="£27 audits" value={`${m.audit27}`} sub={`£${m.audit27Revenue.toFixed(0)} · ${m.conv.qualifyTo27}% of quiz`} accent={GREEN} />
        <Kpi label="£97 upsells" value={`${m.audit97}`} sub={`£${m.audit97Revenue.toFixed(0)} · ${m.attachRate}% attach`} accent={m.audit97 ? GREEN : undefined} />
        <Kpi label="Subscribers" value={`${m.activeSubs}`} sub={`${m.newPaying} new + ${m.legacySubs} legacy · £${m.mrr}/mo`} accent={GREEN} />
      </section>

      {/* Demo requests — follow-up list */}
      {m.recentDemoRequests.length > 0 && (
        <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-400">
            Calls booked &amp; requests
          </h2>
          <div className="space-y-2 text-[13px]">
            {m.recentDemoRequests.map((d) => (
              <div key={d.email} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-semibold text-white">{d.name || d.email}</span>
                <span className="text-neutral-400">{d.email}</span>
                <span className="text-neutral-500">
                  {d.businessType} · {d.locations} locations
                </span>
                {d.scheduledAt ? (
                  <span
                    style={{ color: d.bookingStatus === "cancelled" ? "#e0726e" : GREEN }}
                  >
                    {d.bookingStatus === "cancelled" ? "cancelled" : "booked"}{" "}
                    {d.scheduledAt.slice(0, 16).replace("T", " ")}
                  </span>
                ) : (
                  <span className="text-neutral-600">
                    requested {d.requestedAt.slice(0, 16).replace("T", " ")}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Booked = a self-booked Cal.com slot (invite + reminder sent automatically). This list is the source of
            truth if a Slack alert drops. Older rows may show as a request (pre-Cal flow).
          </p>
        </section>
      )}

      {/* Unworked qualified leads — the chase-and-close list */}
      {m.unworkedQualified.length > 0 && (
        <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-400">
            Qualified leads to chase ({m.unworkedQualified.length})
          </h2>
          <div className="space-y-2 text-[13px]">
            {m.unworkedQualified.map((d) => (
              <div key={d.email} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-semibold text-white">{d.name || d.email}</span>
                <span className="text-neutral-400">{d.email}</span>
                {d.phone && <span className="text-neutral-400">{d.phone}</span>}
                {d.ig && <span style={{ color: GREEN }}>@{d.ig}</span>}
                <span className="text-neutral-500">
                  {d.businessType} · {d.locations} {d.locations === 1 ? "location" : "locations"}
                </span>
                <span className="text-neutral-600">{d.quizzedAt.slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Qualified on the quiz, no call requested and no £27 review bought yet. These are the owners to reach out to
            and close. A Slack alert fires the moment a fresh one qualifies.
          </p>
        </section>
      )}

      {/* Conversion ladder */}
      <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">Conversion ladder</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: "Waitlist", v: m.waitlist, base: m.waitlist },
            { label: "Did the quiz", v: m.qualifyCompletions, base: m.waitlist, rate: m.conv.waitlistToQualify },
            { label: "Bought £27 audit", v: m.audit27, base: m.waitlist, rate: m.conv.waitlistToAudit },
            { label: "Added £97 Loom", v: m.audit97, base: m.waitlist },
            { label: "Became subscriber", v: m.activeSubs, base: m.waitlist },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-neutral-400">{r.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-800">
                <div
                  className="h-full rounded"
                  style={{ width: `${m.waitlist ? Math.max(2, (r.v / m.waitlist) * 100) : 0}%`, background: YELLOW }}
                />
              </div>
              <div className="w-24 shrink-0 text-right tabular-nums text-white">
                {r.v}
                {r.rate !== undefined && <span className="text-neutral-500"> · {r.rate}%</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Read: {m.waitlist} on the list, {m.audit27} bought the £27 audit ({m.conv.waitlistToAudit}% of the waitlist),{" "}
          {m.audit97} took the £97. £97 attach rate on £27 buyers is {m.attachRate}%.
        </p>
      </section>

      {/* Ad funnel flow */}
      <section className="mb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">
          The ad funnel (where Meta ads land)
        </h2>
        {FUNNEL.map((s, i) => (
          <div key={s.id}>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold text-black"
                    style={{ background: YELLOW }}
                  >
                    {s.n}
                  </span>
                  <h3 className="text-base font-bold text-white">{s.title}</h3>
                </div>
                <code className="text-xs text-neutral-500">{s.route}</code>
              </div>
              <p className="mt-2 text-sm text-neutral-400">{s.purpose}</p>

              <div className="mt-3 rounded-lg border border-neutral-800 bg-black/40 p-3">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-neutral-600">Copy on this page</div>
                <ul className="space-y-1 text-[13px] text-neutral-300">
                  {s.copy.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
                <div className="mt-2 text-[13px]">
                  <span className="text-neutral-600">Button: </span>
                  <span className="font-semibold" style={{ color: YELLOW }}>
                    {s.cta}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-neutral-600">Where they go next</div>
                  <ul className="space-y-1 text-[13px] text-neutral-300">
                    {s.next.map((nx, j) => (
                      <li key={j}>
                        <span className="text-neutral-500">{nx.condition}: </span>
                        {nx.target}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-neutral-600">What gets recorded</div>
                  <ul className="space-y-1 text-[13px] text-neutral-400">
                    {s.writes.map((w, j) => (
                      <li key={j}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {i < FUNNEL.length - 1 && <Arrow label={FUNNEL[i].next[0]?.condition ?? ""} />}
          </div>
        ))}

        <div className="mt-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm font-bold text-neutral-300">{WEBHOOK_NOTE.title}</div>
          <code className="text-xs text-neutral-500">{WEBHOOK_NOTE.route}</code>
          <p className="mt-1 text-[13px] text-neutral-400">{WEBHOOK_NOTE.detail}</p>
        </div>
      </section>

      {/* Email sequence */}
      <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-400">Waitlist email sequence</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Sent" value={String(m.emailSent)} sub={`${m.emailErrors} errors`} />
          <Kpi label="Enrolled" value={String(m.enrolled)} sub="in the sequence" />
          <Kpi label="Completed" value={String(m.completions)} sub="reached email 12" />
          <Kpi label="Unsubscribed" value={String(m.unsubs)} accent={m.unsubs ? "#e0726e" : undefined} />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Welcome (day 0) → audit email (day 3) → 10 weekly nurtures. Most recipients sit at position 0 (welcome sent),
          waiting for their cohort day. Open rates show in Resend from now on (open tracking enabled 31 May).
        </p>
      </section>

      {/* SaaS journey */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-neutral-400">
          The SaaS journey (after someone subscribes)
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Separate £300/mo product. Almost empty today: {m.activeSubs} subscriber(s).
        </p>
        <div className="space-y-2">
          {APP_JOURNEY.map((s) => (
            <div key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-white">{s.title}</h3>
                <code className="text-xs text-neutral-500">{s.route}</code>
              </div>
              <p className="mt-1 text-[13px] text-neutral-400">{s.whatHappens}</p>
              <div className="mt-1 text-xs text-neutral-600">Signal: {s.signal}</div>
            </div>
          ))}
        </div>
      </section>

      {/* v8 engine live */}
      <section className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-400">v8 boost engine (live)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="App Review calls"
            value={`${m.v8.callVolume15d}/1500`}
            sub={`15d · ${m.v8.callSuccessRate}% ok`}
            accent={m.v8.callSuccessRate >= 85 ? GREEN : "#e0726e"}
          />
          <Kpi
            label="App usage peak"
            value={`${m.v8.appUsagePeak}%`}
            sub="last 1h sample"
            accent={m.v8.appUsagePeak > 50 ? "#e0726e" : m.v8.appUsagePeak > 35 ? YELLOW : undefined}
          />
          <Kpi label="Breaker trips" value={String(m.v8.breakerTrips24h)} sub="last 24h" accent={m.v8.breakerTrips24h ? YELLOW : undefined} />
          <Kpi label="Intent queue" value={String(m.v8.pendingIntents)} sub="pending" />
          <Kpi label="Campaigns active" value={String(m.v8.campaignsActive)} accent={m.v8.campaignsActive ? GREEN : undefined} />
          <Kpi label="Ad sets live" value={String(m.v8.adsetsLive)} />
          <Kpi label="Ads live" value={String(m.v8.adsLive)} accent={m.v8.adsLive ? GREEN : undefined} />
          <Kpi label="Provisioning" value={`${m.v8.provisioning}+${m.v8.provisioned}`} sub="building + built" />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Gated by V8_ENGINE_ENABLED. Call volume tracks toward Meta&apos;s 1,500-calls/15-day Advanced-Access
          threshold; success rate must stay above 85%. App usage &gt;50% halts both lanes, &gt;35% halts creation.
        </p>
      </section>

      {/* Not SuperPulse */}
      <section className="mb-6 rounded-xl border p-4" style={{ borderColor: "#5a4a1f", background: "#1a160a" }}>
        <div className="text-sm font-bold" style={{ color: YELLOW }}>
          {NOT_SUPERPULSE.title}
        </div>
        <p className="mt-1 text-[13px] text-neutral-300">{NOT_SUPERPULSE.detail}</p>
      </section>

      <footer className="border-t border-neutral-900 pt-4 text-xs text-neutral-600">
        Live data from Turso · refresh to update · internal only
      </footer>
    </main>
  );
}
