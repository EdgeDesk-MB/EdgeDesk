import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Vitest's default exclude only matches a literal "node_modules" dir.
    // Stray .evicted.nosync / .broken.nosync variants left over from past
    // installs slip through and get scanned as test files.
    exclude: [...configDefaults.exclude, "**/node_modules.*/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
});
