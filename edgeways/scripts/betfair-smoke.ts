/**
 * Betfair connection smoke: runs the same login the admin feed test runs,
 * straight from the shell, so exchange failures can be debugged without the
 * admin UI. Prints the raw error chain on failure.
 *
 * Usage: npx tsx --tsconfig scripts/tsconfig.json scripts/betfair-smoke.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { testBetfairConnection } = await import(
    "../src/lib/services/exchange/betfair"
  );
  const result = await testBetfairConnection();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  process.exit(1);
});
