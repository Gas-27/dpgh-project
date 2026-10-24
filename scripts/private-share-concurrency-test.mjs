// Concurrency test for public.private_share_assign: N paid subscriptions race for a pool of seats.
//
// Run ONLY against a disposable database (e.g. a Supabase branch). The audit log is append-only
// by design, so assignments leave audit rows that cannot be deleted. The script refuses to run
// against the production host.
//
//   npm i --prefix /tmp/pgtest pg
//   TEST_DATABASE_URL=postgres://... PRODUCTION_DB_HOST=db.<prod-ref>.supabase.co \
//   NODE_PATH=/tmp/pgtest/node_modules node scripts/private-share-concurrency-test.mjs
//
// Optional: SEATS (default 1), SESSIONS (default 2), HOLD_MS (default 1500).
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const url = process.env.TEST_DATABASE_URL;
const prodHost = process.env.PRODUCTION_DB_HOST;
const seats = Number(process.env.SEATS ?? 1);
const sessions = Number(process.env.SESSIONS ?? 2);
const holdMs = Number(process.env.HOLD_MS ?? 1500);

if (!url) throw new Error("TEST_DATABASE_URL is required");
if (!prodHost) throw new Error("PRODUCTION_DB_HOST is required so the script can refuse to run against production");
const PRODUCTION_PROJECT_REF = "uloaiqmknsrknqikbmtb";
if (new URL(url).hostname === prodHost || url.includes(prodHost) || url.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("Refusing to run against the production database");
}
if (sessions <= seats) throw new Error("SESSIONS must exceed SEATS so at least one request loses");

const tag = `conc-${randomUUID().slice(0, 8)}`;
const connect = async () => {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
};
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(name);
};

const admin = await connect();
let serviceId;
let accountId;
const subscriptionIds = [];

try {
  const svc = await admin.query(
    `insert into public.digital_services (slug, name, category, service_type, active)
     values ($1, $2, 'test', 'private_shared', false) returning id`,
    [tag, `Concurrency ${tag}`],
  );
  serviceId = svc.rows[0].id;
  await admin.query(
    `insert into public.private_share_product_config (service_id, enabled, entitlement_days, approved_at)
     values ($1, true, 30, now())`,
    [serviceId],
  );
  const acct = await admin.query(
    `insert into public.private_share_accounts (service_id, label, capacity, account_subscription_expires_at)
     values ($1, $2, $3, now() + interval '90 days') returning id`,
    [serviceId, `acct-${tag}`, seats],
  );
  accountId = acct.rows[0].id;
  for (let i = 0; i < sessions; i += 1) {
    const sub = await admin.query(
      `insert into public.private_share_subscriptions
         (payment_reference, service_id, service_name, amount, payment_status, paid_at)
       values ($1, $2, $3, 10, 'paid', now()) returning id`,
      [`${tag}-${i}`, serviceId, `Concurrency ${tag}`],
    );
    subscriptionIds.push(sub.rows[0].id);
  }

  // Each session opens a transaction, assigns, then holds the transaction open so the others
  // must queue on the account row lock before it commits.
  const clients = await Promise.all(subscriptionIds.map(connect));
  await Promise.all(clients.map((c) => c.query("begin")));
  const results = await Promise.all(
    clients.map(async (client, i) => {
      const res = await client.query("select public.private_share_assign($1) as r", [subscriptionIds[i]]);
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      await client.query("commit");
      return res.rows[0].r;
    }),
  );
  await Promise.all(clients.map((c) => c.end()));

  const active = results.filter((r) => r.status === "active");
  const pending = results.filter((r) => r.status === "pending_fulfillment");
  check("winners equal available seats", active.length === seats, `${active.length} active of ${seats} seats`);
  check("every loser is pending_fulfillment", pending.length === sessions - seats, `${pending.length} pending`);
  check("no other statuses returned", active.length + pending.length === sessions);

  const occupied = await admin.query(
    `select count(*)::int as n from public.private_share_assignments
     where account_id = $1 and status in ('active','expired','revoked')`,
    [accountId],
  );
  check("occupied seats never exceed capacity", occupied.rows[0].n <= seats, `${occupied.rows[0].n}/${seats}`);

  const rows = await admin.query(
    `select status, account_id from public.private_share_assignments where subscription_id = any($1)`,
    [subscriptionIds],
  );
  check("one assignment row per subscription", rows.rowCount === sessions, `${rows.rowCount} rows`);
  check("pending rows hold no account", rows.rows.filter((r) => r.status === "pending_fulfillment").every((r) => r.account_id === null));

  const rerun = await admin.query("select public.private_share_assign($1) as r", [subscriptionIds[0]]);
  check("repeat call is idempotent", rerun.rows[0].r.status === results[0].status || rerun.rows[0].r.already_processed === true);
} finally {
  // Audit rows are immutable, so only the mutable seed data is removed.
  if (subscriptionIds.length) {
    await admin.query("delete from public.private_share_verification_requests where assignment_id in (select id from public.private_share_assignments where subscription_id = any($1))", [subscriptionIds]).catch(() => {});
    await admin.query("delete from public.private_share_assignments where subscription_id = any($1)", [subscriptionIds]).catch(() => {});
    await admin.query("delete from public.private_share_subscriptions where id = any($1)", [subscriptionIds]).catch(() => {});
  }
  if (accountId) await admin.query("delete from public.private_share_accounts where id = $1", [accountId]).catch(() => {});
  if (serviceId) {
    await admin.query("delete from public.private_share_product_config where service_id = $1", [serviceId]).catch(() => {});
    await admin.query("delete from public.digital_services where id = $1", [serviceId]).catch(() => {});
  }
  await admin.end();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll concurrency checks passed");
