import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run via `npm run demo:seed` " +
      "(uses `node --env-file=.env.local`), not `node scripts/demo-seed/seed.mjs` directly."
  );
}

export const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function batchInsert(table, rows, batchSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`insert into ${table} failed at row ${i}: ${error.message}`);
  }
  console.log(`  + ${rows.length} rows -> ${table}`);
}

export async function batchUpsert(table, rows, onConflict, batchSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`upsert into ${table} failed at row ${i}: ${error.message}`);
  }
  console.log(`  + ${rows.length} rows -> ${table} (upsert)`);
}

// uuid columns don't support LIKE directly over PostgREST, so the "starts
// with 5eed0000" match is expressed as a range: every uuid whose first 4
// bytes (first hex group) equal 5eed0000 falls in
// [5eed0000-0000-..., 5eed0001-0000-...).
const DEMO_LO = "5eed0000-0000-0000-0000-000000000000";
const DEMO_HI = "5eed0001-0000-0000-0000-000000000000";

export async function batchDeleteByPrefix(table, idColumn = "id") {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .gte(idColumn, DEMO_LO)
    .lt(idColumn, DEMO_HI);
  if (error) throw new Error(`delete from ${table} failed: ${error.message}`);
  console.log(`  - ${count ?? 0} rows <- ${table}`);
  return count ?? 0;
}
