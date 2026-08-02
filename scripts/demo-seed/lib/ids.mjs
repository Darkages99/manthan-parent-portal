import { createHash } from "node:crypto";

// Every row this seed creates gets a primary-key UUID starting with this
// literal, valid-hex prefix ("seed"). Teardown finds every demo row with
// `where id::text like '5eed0000-%'` and nothing else ever matches it — the
// pre-existing hand-written placeholder seed (a0/b0/c0/d0000000-...) is a
// different prefix and is never touched.
export const DEMO_PREFIX = "5eed0000";

// Deterministic: the same (kind, key) always yields the same id, so the
// generator is reproducible across runs without needing a real UUID table.
export function demoId(kind, key) {
  const hash = createHash("sha1").update(`${kind}:${key}`).digest("hex");
  const rest = hash.slice(0, 24);
  return `${DEMO_PREFIX}-${rest.slice(0, 4)}-${rest.slice(4, 8)}-${rest.slice(8, 12)}-${rest.slice(12, 24)}`;
}
