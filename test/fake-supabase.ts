import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Row = Record<string, unknown>;
type Op =
  | ["eq", string, unknown]
  | ["in", string, unknown[]]
  | ["lte" | "gte", string, string | number]
  | ["or", string]
  | ["order", string]
  | ["limit", number];

type RecordedQuery = { table: string; ops: Op[] };
type RecordedWrite = { table: string; kind: "insert" | "upsert" | "update" | "delete"; payload?: unknown; options?: unknown };

/**
 * In-memory stand-in for the slice of supabase-js the app's pure-ish modules use.
 * `eq` / `in` filters are really applied to the rows, so tests that depend on
 * scoping (e.g. "only this teacher's classes") exercise the filter rather than
 * a canned answer. Joined/embedded columns are just extra fields on the row.
 * Not a SQL engine: no RLS, no ordering semantics beyond recording the call.
 */
export function fakeSupabase(
  tables: Record<string, Row[]>,
  opts: { error?: string; rpc?: Record<string, (args: unknown) => unknown> } = {},
) {
  const queries: RecordedQuery[] = [];
  const writes: RecordedWrite[] = [];

  const client = {
    rpc: async (name: string, args: unknown) => {
      const fn = opts.rpc?.[name];
      if (!fn) return { data: null, error: { message: `no fake rpc ${name}` } };
      return { data: fn(args), error: null };
    },
    from(table: string) {
      const rec: RecordedQuery = { table, ops: [] };
      queries.push(rec);
      let rows = [...(tables[table] ?? [])];
      const result = () =>
        opts.error ? { data: null, error: { message: opts.error } } : { data: rows, error: null };

      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          rec.ops.push(["eq", col, val]);
          rows = rows.filter((r) => r[col] === val);
          return q;
        },
        in: (col: string, vals: unknown[]) => {
          rec.ops.push(["in", col, vals]);
          rows = rows.filter((r) => vals.includes(r[col]));
          return q;
        },
        lte: (col: string, val: string | number) => {
          rec.ops.push(["lte", col, val]);
          rows = rows.filter((r) => (r[col] as string | number) <= val);
          return q;
        },
        gte: (col: string, val: string | number) => {
          rec.ops.push(["gte", col, val]);
          rows = rows.filter((r) => (r[col] as string | number) >= val);
          return q;
        },
        // Understands only `col.in.(a,b),col2.in.(c)` — the one `or(...)` shape the app uses.
        // Any other expression is recorded but leaves the rows untouched.
        or: (expr: string) => {
          rec.ops.push(["or", expr]);
          const clauses = [...expr.matchAll(/(\w+)\.in\.\(([^)]*)\)/g)].map(
            (m) => [m[1], m[2].split(",")] as const,
          );
          if (clauses.length > 0) {
            rows = rows.filter((r) => clauses.some(([col, vals]) => vals.includes(String(r[col]))));
          }
          return q;
        },
        delete: () => ({
          eq: async (col: string, val: unknown) => {
            writes.push({ table, kind: "delete", payload: { [col]: val } });
            return { error: null };
          },
        }),
        order: (col: string) => {
          rec.ops.push(["order", col]);
          return q;
        },
        limit: (n: number) => {
          rec.ops.push(["limit", n]);
          rows = rows.slice(0, n);
          return q;
        },
        maybeSingle: async () =>
          opts.error ? { data: null, error: { message: opts.error } } : { data: rows[0] ?? null, error: null },
        single: async () =>
          opts.error ? { data: null, error: { message: opts.error } } : { data: rows[0] ?? null, error: null },
        insert: async (payload: unknown) => {
          writes.push({ table, kind: "insert", payload });
          return { error: opts.error ? { message: opts.error } : null };
        },
        upsert: async (payload: unknown, options?: unknown) => {
          writes.push({ table, kind: "upsert", payload, options });
          return { error: opts.error ? { message: opts.error } : null };
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve, reject),
      };
      return q;
    },
  } as unknown as SupabaseClient<Database>;

  /** Untyped `from`, for wrappers that delegate to the fake by a runtime table name. */
  const from = (table: string) => (client as unknown as { from(t: string): unknown }).from(table);

  return { client, queries, writes, from };
}
