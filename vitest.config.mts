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
    // Component tests opt into a DOM with `// @vitest-environment happy-dom`.
    environment: "node",
    // Unit tests live next to the code. e2e/ belongs to Playwright, not Vitest.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/supabase/database.types.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      // Ratchet: set just under the current numbers. Raise these as tests land; never
      // lower them. What's left uncovered is the thin Supabase/Firebase/QR wrappers.
      thresholds: { lines: 95, statements: 94, functions: 92, branches: 84 },
    },
  },
});
