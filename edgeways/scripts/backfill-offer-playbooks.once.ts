/**
 * ONE-OFF ops script — not a product feature.
 *
 * Attaches O1 completion playbooks to active/planned sports campaigns that
 * do not already have one, so Steps show like newly pasted offers.
 *
 * Run from edgeways/:
 *   npx tsx scripts/backfill-offer-playbooks.once.ts
 *
 * Optional:
 *   EDGEWAYS_DB_PATH=/path/to/edgeways.db npx tsx scripts/backfill-offer-playbooks.once.ts
 *   DRY_RUN=1 npx tsx scripts/backfill-offer-playbooks.once.ts
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { buildRulesJsonWithPlaybook } from "../src/lib/offers/offer-rules-payload";
import { readPlaybookFromRulesJson } from "../src/lib/offers/offer-playbook";
import { readImportantTerms } from "../src/lib/offers/offer-terms";
import { parseOfferRules } from "../src/lib/offers/racing-offer-rules";

function resolveDbPath(): string {
  const override = process.env.EDGEWAYS_DB_PATH?.trim();
  if (override) return path.resolve(override);
  const dataDir = path.join(process.cwd(), "data");
  if (fs.existsSync(path.join(dataDir, "demo-mode"))) {
    return path.join(dataDir, "edgeways-demo.db");
  }
  return path.join(dataDir, "edgeways.db");
}

type OfferRow = {
  id: number;
  title: string;
  bookmaker: string | null;
  sport: string | null;
  offer_type: string | null;
  status: string;
  rules: string | null;
};

function main() {
  const dbPath = resolveDbPath();
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  const rows = sqlite
    .prepare(
      `SELECT id, title, bookmaker, sport, offer_type, status, rules
       FROM offers
       WHERE status IN ('active', 'planned')
       ORDER BY id`
    )
    .all() as OfferRow[];

  const update = sqlite.prepare(`UPDATE offers SET rules = ? WHERE id = ?`);

  let skippedCasino = 0;
  let alreadyHad = 0;
  let attached = 0;
  let failed = 0;
  const attachedTitles: string[] = [];

  const run = sqlite.transaction(() => {
    for (const row of rows) {
      const sport = (row.sport ?? "").toLowerCase();
      if (sport === "casino" || row.offer_type === "casino") {
        skippedCasino += 1;
        continue;
      }

      if (readPlaybookFromRulesJson(row.rules)) {
        alreadyHad += 1;
        continue;
      }

      const offerShape = {
        rules: row.rules,
        offerType: row.offer_type,
      };
      const important = readImportantTerms(offerShape);
      const racingRules = parseOfferRules(offerShape);

      try {
        const nextRules = buildRulesJsonWithPlaybook({
          important,
          racingRules,
          betStake: racingRules?.betStake ?? important.minStake,
          freeBetAmount: racingRules?.freeBetAmount ?? null,
          bookmaker: row.bookmaker,
          previousRulesJson: row.rules,
        });

        if (!nextRules || !readPlaybookFromRulesJson(nextRules)) {
          failed += 1;
          console.warn(`  skip #${row.id} ${row.title}: could not derive playbook`);
          continue;
        }

        if (!dryRun) {
          update.run(nextRules, row.id);
        }
        attached += 1;
        attachedTitles.push(`#${row.id} ${row.title}`);
      } catch (e) {
        failed += 1;
        console.warn(`  fail #${row.id} ${row.title}:`, e);
      }
    }
  });

  run();
  sqlite.close();

  console.log(
    [
      dryRun ? "DRY RUN — no writes" : "Backfill complete",
      `db: ${dbPath}`,
      `scanned: ${rows.length}`,
      `attached: ${attached}`,
      `already had playbook: ${alreadyHad}`,
      `skipped casino: ${skippedCasino}`,
      `failed: ${failed}`,
    ].join("\n")
  );
  if (attachedTitles.length > 0) {
    console.log("\nAttached:");
    for (const t of attachedTitles) console.log(`  ${t}`);
  }
}

main();
