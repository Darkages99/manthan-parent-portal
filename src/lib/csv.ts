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
    let str = value === null || value === undefined ? "" : String(value);
    // Neutralize CSV/formula injection: a cell that a spreadsheet would
    // interpret as a formula (leading = + - @, or tab/CR) is prefixed with a
    // single quote so Excel/Sheets renders it as literal text. See OWASP
    // "CSV Injection". Guardian-controlled fields (names, messages) end up here.
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
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

/**
 * Parses a CSV string into rows of string cells, handling quoted fields
 * (with escaped `""` and embedded commas/newlines) and both `\r\n` and `\n`
 * line endings. The first row is assumed to be a header row.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();

  const [header, ...dataRows] = rows;
  return { header: (header ?? []).map((h) => h.trim()), rows: dataRows };
}
