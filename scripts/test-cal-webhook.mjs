// Local verification of /api/webhook/cal — signature reject, valid booking DB
// write, idempotent replay, and cancel. Side effects (Slack/CAPI/email) are
// disabled via empty env on the dev server. Seeds + cleans up a test row.
// Run: node --env-file=.env.local scripts/test-cal-webhook.mjs
import { createClient } from "@libsql/client";
import crypto from "crypto";

const URL = "http://localhost:3099/api/webhook/cal";
const SECRET = "calwebhooktestsecret";
const EMAIL = "cal-test-15jun@huddleduck.co.uk";
const UID = "caltest-uid-001";
const START = "2026-06-20T14:00:00.000Z";

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

function sign(raw) {
  return crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
}
async function post(bodyObj, sig) {
  const raw = JSON.stringify(bodyObj);
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cal-signature-256": sig ?? sign(raw) },
    body: raw,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}
function created(trigger = "BOOKING_CREATED") {
  return {
    triggerEvent: trigger,
    payload: {
      uid: UID,
      title: "SuperPulse demo",
      startTime: START,
      attendees: [{ email: EMAIL, name: "Test Owner" }],
      responses: {
        sp_email: { value: EMAIL },
        name: { value: "Test Owner" },
        email: { value: EMAIL },
      },
    },
  };
}
async function row() {
  const r = await db.execute({
    sql: `SELECT demo_scheduled_at, cal_booking_uid, demo_booking_status, demo_offer_choice, demo_requested_at FROM qualifier_responses WHERE email=?`,
    args: [EMAIL],
  });
  return r.rows[0];
}
async function eventCount(trigger) {
  const r = await db.execute({
    sql: `SELECT COUNT(*) c FROM cal_webhook_events WHERE cal_booking_uid=? AND trigger_event=?`,
    args: [UID, trigger],
  });
  return Number(r.rows[0].c);
}

const results = [];
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  // clean + seed
  await db.execute({ sql: `DELETE FROM cal_webhook_events WHERE cal_booking_uid=?`, args: [UID] });
  await db.execute({ sql: `DELETE FROM qualifier_responses WHERE email=?`, args: [EMAIL] });
  await db.execute({ sql: `DELETE FROM waitlist WHERE email=?`, args: [EMAIL] });
  await db.execute({
    sql: `INSERT INTO waitlist (email, name, first_name, phone, instagram_handle, source) VALUES (?,?,?,?,?,?)`,
    args: [EMAIL, "Test Owner", "Test Owner", "+447000000000", "testowner", "test"],
  });
  await db.execute({
    sql: `INSERT INTO qualifier_responses (email, business_type, locations_count, qualified, updated_at) VALUES (?,?,?,?,?)`,
    args: [EMAIL, "restaurant", 2, 1, new Date().toISOString()],
  });

  // 1) bad signature
  const bad = await post(created(), "deadbeefbad");
  check("bad signature rejected (400)", bad.status === 400, `got ${bad.status}`);

  // 2) valid BOOKING_CREATED
  const ok = await post(created());
  check("valid booking accepted (200 ok)", ok.status === 200 && ok.json?.ok === true, JSON.stringify(ok.json));
  const r1 = await row();
  check("demo_scheduled_at set to start time", r1?.demo_scheduled_at === START, String(r1?.demo_scheduled_at));
  check("cal_booking_uid recorded", r1?.cal_booking_uid === UID, String(r1?.cal_booking_uid));
  check("status = booked", r1?.demo_booking_status === "booked", String(r1?.demo_booking_status));
  check("demo_offer_choice = yes", r1?.demo_offer_choice === "yes", String(r1?.demo_offer_choice));
  check("demo_requested_at backfilled", !!r1?.demo_requested_at, String(r1?.demo_requested_at));
  check("one webhook event logged", (await eventCount("BOOKING_CREATED")) === 1);

  // 3) replay — idempotent
  const replay = await post(created());
  check("replay deduped (duplicate:true)", replay.status === 200 && replay.json?.duplicate === true, JSON.stringify(replay.json));
  check("still one webhook event after replay", (await eventCount("BOOKING_CREATED")) === 1);

  // 4) cancel
  const cancel = await post(created("BOOKING_CANCELLED"));
  check("cancel accepted (200)", cancel.status === 200, JSON.stringify(cancel.json));
  const r2 = await row();
  check("status = cancelled", r2?.demo_booking_status === "cancelled", String(r2?.demo_booking_status));

  // cleanup
  await db.execute({ sql: `DELETE FROM cal_webhook_events WHERE cal_booking_uid=?`, args: [UID] });
  await db.execute({ sql: `DELETE FROM qualifier_responses WHERE email=?`, args: [EMAIL] });
  await db.execute({ sql: `DELETE FROM waitlist WHERE email=?`, args: [EMAIL] });
  console.log("\ncleaned up test rows");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
