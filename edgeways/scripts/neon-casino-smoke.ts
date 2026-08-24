/**
 * Hosted casino desk smoke test (casino cutover). Runs the real Neon code
 * paths as the desk owner against the live hosted database:
 *
 *   1. Reads: restored casino rows summarise correctly (offers, EV, games)
 *   2. Snapshot: casinoProfit / settledProfit / bankroll match expectations
 *   3. Writes: create campaign -> add component -> complete with profit ->
 *      verify wallet tx + history row -> delete -> verify ledger cleaned up
 *
 * Usage: npm run db:casino-smoke
 *
 * The write test creates a clearly-named throwaway campaign and always
 * deletes it (try/finally). Safe to re-run.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

process.env.EDGEWAYS_DESK_BACKEND = "neon";

const OWNER = {
  clerkUserId: "user_3HqzZ0vGHKdHGozq8a064YzgQWk",
  email: "samhayter.design@gmail.com",
};

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`, ok ? "" : { actual, expected });
}

async function main() {
  const { runWithDeskActor } = await import("../src/lib/db/desk-scope");
  const casino = await import("../src/lib/db/neon-desk-casino");
  const { appStateFromNeonDesk } = await import("../src/lib/db/neon-desk-state-map");
  const { listNeonDeskBets } = await import("../src/lib/db/neon-desk");
  const { listNeonDeskOffers } = await import("../src/lib/db/neon-desk-offers");
  const {
    listNeonDeskAccounts,
    listNeonDeskBalanceTransactions,
  } = await import("../src/lib/db/neon-desk-accounts");
  const { listNeonDeskHistory } = await import("../src/lib/db/neon-desk-history");

  await runWithDeskActor(OWNER, async () => {
    // -- 1. Reads ------------------------------------------------------------
    const rows = await casino.listNeonDeskCasinoRows();
    check("casino offers restored", rows.offers.length, 74);
    check("casino games restored", rows.games.length, 212);
    check("casino components restored", rows.components.length, 160);

    const summaries = casino.summariseNeonCasinoOffers(rows);
    check("summaries count", summaries.length, 74);
    const withComponents = summaries.filter((s) => s.components.length > 0);
    check("summaries with components", withComponents.length > 0, true);
    const completed = summaries.filter((s) => s.status === "completed");
    check("completed campaigns", completed.length > 0, true);

    // -- 2. Snapshot ---------------------------------------------------------
    const [bets, offers, accounts, transactions, history] = await Promise.all([
      listNeonDeskBets(),
      listNeonDeskOffers(),
      listNeonDeskAccounts(),
      listNeonDeskBalanceTransactions(),
      listNeonDeskHistory(),
    ]);
    const state = appStateFromNeonDesk({
      bets,
      offers,
      accounts,
      transactions,
      history,
      casinoOffers: rows.offers,
    });
    check("casinoProfit", state.casinoProfit, 120.74);
    check("settledProfit (betting + casino + adjustments)", state.settledProfit, 534.27);
    check("bankroll", state.balances.bankroll, 259.6);
    check("casinoNeedsAction >= 0", state.casinoNeedsAction >= 0, true);
    check("casinoSettlements present", state.casinoSettlements.length > 0, true);

    // -- 3. Write cycle (throwaway campaign, always cleaned up) ---------------
    const marker = `SMOKE TEST ${Date.now()}`;
    let createdId: number | null = null;
    try {
      const created = await casino.insertNeonDeskCasinoOffer({
        casino: "Dynobet",
        title: marker,
        status: "planned",
      });
      createdId = created.id;
      check("created campaign", typeof created.id, "number");

      await casino.insertNeonDeskCasinoComponent({
        casinoOfferId: created.id,
        componentType: "cash",
        amount: 10,
        wageringMultiplier: null,
        rtp: 1,
        contributionPct: null,
        spins: null,
        spinValue: null,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        eligibleGamesJson: null,
        expectedEv: 10,
        sortOrder: 0,
      });
      const withComp = await casino.getNeonCasinoOfferSummary(created.id);
      check("component attached", withComp?.components.length, 1);
      check("summary EV", withComp?.expectedEv, 10);

      const done = await casino.patchNeonDeskCasinoOffer(created.id, {
        status: "completed",
        actualProfit: 0.01,
        completedAt: Date.now(),
      });
      check("completed patch", done?.status, "completed");
      if (done) await casino.syncNeonCasinoOfferBalance(done);

      const txsAfter = await listNeonDeskBalanceTransactions();
      const ledgerTx = txsAfter.find((t) => t.casinoOfferId === created.id);
      check("ledger tx written", ledgerTx?.category, "casino_settlement");
      check("ledger tx amount", ledgerTx?.amount, 0.01);

      const historyAfter = await listNeonDeskHistory();
      const feedRow = historyAfter.find((h) => h.dedupe === `casino:${created.id}`);
      check("history feed row", feedRow?.kind, "casino_settlement");
    } finally {
      if (createdId != null) {
        const offer = await casino.getNeonDeskCasinoOffer(createdId);
        if (offer) await casino.deleteNeonDeskCasinoOffer(offer, "instance");
      }
    }

    const txsFinal = await listNeonDeskBalanceTransactions();
    check(
      "ledger cleaned after delete",
      txsFinal.some((t) => t.casinoOfferId === createdId),
      false
    );
    const historyFinal = await listNeonDeskHistory();
    check(
      "feed row cleaned after delete",
      historyFinal.some((h) => h.dedupe === `casino:${createdId}`),
      false
    );
    const offersFinal = await casino.listNeonDeskCasinoOffers();
    check("throwaway campaign gone", offersFinal.some((o) => o.title === marker), false);
    check("restored offers untouched", offersFinal.length, 74);
  });

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nHosted casino smoke: all checks passed");
}

main().catch((err) => {
  console.error("Hosted casino smoke failed:", err);
  process.exit(1);
});
