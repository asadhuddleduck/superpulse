// Create (or re-invite) an Agency HQ operator account.
//
//   node --env-file=.env.local scripts/create-hq-user.mjs \
//        --email hello@asadshah.co.uk --name "Asad Shah" --role owner [--password SECRET] [--url https://www.superpulse.io]
//
// With --password: account is created active with that password.
// Without:        account is created 'invited' and an accept link is printed
//                 (and emailed if you wire that in) so they set their own.
import { createClient } from "@libsql/client";
import { randomBytes, scryptSync, createHash } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]?.startsWith("--") ? "true" : arr[i + 1]]);
    return acc;
  }, []),
);

const email = (args.email || "").toLowerCase().trim();
const name = args.name || null;
const role = args.role || "member";
const password = args.password || null;
const baseUrl = args.url || "https://www.superpulse.io";

if (!email) {
  console.error("Missing --email");
  process.exit(1);
}
if (!["owner", "admin", "member"].includes(role)) {
  console.error("--role must be owner | admin | member");
  process.exit(1);
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Must match src/lib/hq-auth.ts hashPassword() exactly.
function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${hash.toString("base64")}`;
}
const sha256hex = (s) => createHash("sha256").update(s).digest("hex");

async function main() {
  const existing = await db.execute({ sql: "SELECT id FROM hq_users WHERE email = ?", args: [email] });
  let id;
  if (existing.rows.length) {
    id = existing.rows[0].id;
    console.log(`User ${email} already exists (${id}) — updating role/name.`);
    await db.execute({ sql: "UPDATE hq_users SET role = ?, name = COALESCE(?, name) WHERE id = ?", args: [role, name, id] });
  } else {
    id = `hqu_${randomBytes(8).toString("hex")}`;
    await db.execute({
      sql: "INSERT INTO hq_users (id, email, name, role, status) VALUES (?, ?, ?, ?, ?)",
      args: [id, email, name, role, password ? "active" : "invited"],
    });
    console.log(`Created ${email} (${id}) role=${role}`);
  }

  if (password) {
    await db.execute({
      sql: "UPDATE hq_users SET password_hash = ?, status = 'active' WHERE id = ?",
      args: [hashPassword(password), id],
    });
    console.log(`Password set. Sign in at ${baseUrl}/admin/login`);
  } else {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: "INSERT INTO hq_password_resets (token_hash, user_id, purpose, expires_at) VALUES (?, ?, 'invite', ?)",
      args: [sha256hex(token), id, expiresAt],
    });
    console.log(`\nAccept-invite link (valid 7 days):\n${baseUrl}/admin/accept?token=${token}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
