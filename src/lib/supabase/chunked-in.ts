import "server-only";

// A GET with `.in(column, ids)` puts every id in the URL. With a few hundred
// ids that URL can exceed the platform's request-size limit and the query
// fails outright — which, if the error is ignored (`data ?? []`), silently
// reads back as "no rows" and makes real data (e.g. a school's exam results)
// look like it doesn't exist. Chunking keeps each request's id list short.
const CHUNK_SIZE = 200;

/**
 * Runs `queryFn` once per chunk of `ids` and concatenates the results. Throws
 * on any chunk's error rather than swallowing it into an incomplete result.
 */
export async function fetchInChunks<Row>(
  ids: string[],
  // PromiseLike, not Promise — Supabase's query builder is thenable but isn't
  // a real Promise instance (it only implements .then, not .catch/.finally).
  queryFn: (chunk: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
): Promise<Row[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

  const results = await Promise.all(chunks.map((chunk) => queryFn(chunk)));
  const rows: Row[] = [];
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    rows.push(...(r.data ?? []));
  }
  return rows;
}
