import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Unit tests live next to the code. e2e/ belongs to Playwright, not Vitest.
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/supabase/database.types.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      // Ratchet, not the goal: the target is 80% lines (TODO 2A). The gap is almost all
      // google-sheets.ts and the thin Supabase/Firebase wrappers. Raise these as tests
      // land; never lower them.
      thresholds: { lines: 57, statements: 58, functions: 67, branches: 54 },
    },
  },
});
