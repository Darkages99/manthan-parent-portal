/**
 * Builds a CSV string from an array of flat row objects.
 * Headers are taken from the first row's keys (all rows are expected to share the same shape).
 * Fields containing a comma, quote, or newline are wrapped in double quotes, with internal
 * quotes doubled — standard CSV quoting. Rows are joined with `\r\n` per the CSV convention.
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\r\n");
}
