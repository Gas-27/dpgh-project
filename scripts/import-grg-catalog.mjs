// Imports the GainRealGrowth catalog (scripts/grg-catalog.json) into Social Boost.
// GRG service IDs overlap ExoBoost IDs, so each service gets a local ID of 100000 + GRG ID,
// is pinned to the gainrealgrowth provider, and gets a route mapping back to the real GRG ID.
// Safe to re-run: rows are upserted by local service ID.
//
// Usage: node --env-file-if-exists=/vercel/share/.env.project scripts/import-grg-catalog.mjs [--dry]
import { readFileSync } from "node:fs";

const PROVIDER_ID = "gainrealgrowth";
const ID_OFFSET = 100000;
const MARKUP = 1.3;
const DRY = process.argv.includes("--dry");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!url || !key)) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const clean = (value) =>
  String(value)
    .normalize("NFKC")
    .replace(/&amp;/g, "&")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/\|\s*$/, "")
    .trim();

// The pasted catalog repeats every category title twice ("Instagram Likes  Instagram Likes").
const cleanCategory = (value) => {
  const text = clean(value);
  const half = Math.floor(text.length / 2);
  const first = text.slice(0, half).trim();
  const second = text.slice(half).trim();
  return first && first === second ? first : text;
};

const roundUp = (n) => Math.ceil(n * 100) / 100;

const source = JSON.parse(readFileSync(new URL("./grg-catalog.json", import.meta.url), "utf8"));

const skipped = [];
const usable = source.filter((row) => {
  // Fixed-price packages (max quantity 1) cannot be priced per 1000 units.
  if (row.max <= 1) { skipped.push(row); return false; }
  return Number(row.rate) > 0;
});

const seen = new Map();
for (const row of [...usable].sort((a, b) => a.rate - b.rate)) {
  const k = `${cleanCategory(row.category)}|${clean(row.name)}`;
  seen.set(k, [...(seen.get(k) ?? []), row.id]);
}

const pricing = [];
const routes = [];
for (const row of usable) {
  const category = cleanCategory(row.category);
  let name = clean(row.name);
  const group = seen.get(`${category}|${name}`);
  if (group.length > 1) name = `${name} · Option ${group.indexOf(row.id) + 1}`;

  const admin = Math.max(0.01, roundUp(row.rate * MARKUP));
  const localId = ID_OFFSET + row.id;
  const waiting = /not enough data/i.test(row.time ?? "");
  pricing.push({
    service_id: localId,
    service_name: name,
    category,
    provider_rate: row.rate,
    admin_price_per_1000: admin,
    base_price_per_1000: admin,
    default_price_per_1000: roundUp(admin * 1.33),
    max_reseller_price_per_1000: roundUp(admin * 1.67),
    min_quantity: row.min,
    max_quantity: row.max,
    average_completion_time: waiting ? "" : row.time,
    notes: null,
    provider: PROVIDER_ID,
    updated_at: new Date().toISOString(),
  });
  routes.push({ service_id: localId, provider_id: PROVIDER_ID, provider_service_id: String(row.id), updated_at: new Date().toISOString() });
}

console.log(`catalog ${source.length}, importing ${pricing.length}, skipped fixed packages ${skipped.length}`);
if (DRY) { console.log(JSON.stringify(pricing.slice(0, 3), null, 1)); process.exit(0); }

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 400) {
    const response = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", headers, body: JSON.stringify(rows.slice(i, i + 400)) });
    if (!response.ok) throw new Error(`${table} batch ${i}: ${response.status} ${await response.text()}`);
  }
  console.log(`${table}: ${rows.length} rows upserted`);
}

await upsert("social_boost_service_pricing", pricing, "service_id");
await upsert("social_boost_service_routes", routes, "service_id,provider_id");
