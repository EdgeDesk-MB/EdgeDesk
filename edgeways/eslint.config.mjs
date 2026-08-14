import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: [
      "src/lib/accounts/**/*.ts",
      "src/lib/services/daily-tasks-digest.ts",
      "src/lib/services/state.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/services/quiet-alerts",
              message:
                "This module is in the /api/state graph. Call quietOfferAlerts / quietFreeBetAlerts from the mutation API, not from lots, digest, or state.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/services/quiet-alerts.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/alerts/rules",
              message:
                "Import dedupe keys from @/lib/alerts/expiring-alert-keys. rules.ts is also a client import.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
