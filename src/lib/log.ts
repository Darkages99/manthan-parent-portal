import "server-only";

// DG-4 (compliance/09) — sanitized server logging.
//
// Server logs (Vercel) are retained outside the app's access controls, so they
// must never carry PII or user free-text: message bodies, names, emails, phone
// numbers, reasons, titles, or raw error messages that can echo row values.
// Log a stable tag plus a non-sensitive error *code/name* only. Use these
// helpers instead of `console.error(tag, err.message)` / `console.error(tag, err)`.

type SafeErrorShape = { code?: unknown; name?: unknown; statusCode?: unknown };

/** Extracts a non-sensitive identifier for an error — a DB error code, HTTP
 * status, or the error class name — never its message. */
export function errorCode(err: unknown): string {
  if (err == null) return "unknown";
  if (typeof err !== "object") return "error";
  const e = err as SafeErrorShape;
  if (typeof e.code === "string" && e.code) return e.code;
  if (typeof e.statusCode === "number") return String(e.statusCode);
  if (typeof e.name === "string" && e.name) return e.name;
  return "error";
}

/** Logs `tag [code]` — safe to keep in retained logs. */
export function logError(tag: string, err?: unknown): void {
  console.error(err === undefined ? tag : `${tag} [${errorCode(err)}]`);
}
