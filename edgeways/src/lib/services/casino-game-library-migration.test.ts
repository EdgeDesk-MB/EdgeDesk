import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appSettings, casinoGames, db, runCasinoGameLibraryBackfill } from "@/lib/db";
import {
  CLASSIC_SEED_GAMES,
  BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21,
  COMMON_UK_SLOTS_2026_07_21,
} from "@/lib/casino/game-library";

const CLASSIC_MARKER = "casino_games_backfill_classic";
const BETFAIR_MARKER = "casino_games_backfill_2026_07_21";
const COMMON_MARKER = "casino_games_backfill_2026_07_21_common_uk_slots";

function reset() {
  db.delete(casinoGames).run();
  db.delete(appSettings).where(eq(appSettings.key, CLASSIC_MARKER)).run();
  db.delete(appSettings).where(eq(appSettings.key, BETFAIR_MARKER)).run();
  db.delete(appSettings).where(eq(appSettings.key, COMMON_MARKER)).run();
}

function runClassicBatch() {
  return runCasinoGameLibraryBackfill(CLASSIC_MARKER, CLASSIC_SEED_GAMES);
}

function runBetfairBatch() {
  return runCasinoGameLibraryBackfill(BETFAIR_MARKER, BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21);
}

function runCommonBatch() {
  return runCasinoGameLibraryBackfill(COMMON_MARKER, COMMON_UK_SLOTS_2026_07_21);
}

describe("casino game library backfills (dated batches)", () => {
  beforeEach(reset);

  it("backfills a batch into an empty library and sets that batch's marker", () => {
    const inserted = runBetfairBatch();
    expect(inserted).toBe(BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21.length);

    const rows = db.select().from(casinoGames).all();
    expect(rows).toHaveLength(BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21.length);

    const marker = db.select().from(appSettings).where(eq(appSettings.key, BETFAIR_MARKER)).get();
    expect(marker?.value).toBe("done");
  });

  it("a later batch reaches an existing library after an earlier batch's marker is already set", () => {
    runBetfairBatch();
    const secondBatchInserted = runCommonBatch();
    expect(secondBatchInserted).toBe(COMMON_UK_SLOTS_2026_07_21.length);

    const rows = db.select().from(casinoGames).all();
    expect(rows).toHaveLength(
      BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21.length + COMMON_UK_SLOTS_2026_07_21.length
    );
  });

  it("a fresh install running all three bootstrap batches in order ends up with every game, including classic", () => {
    // Regression: the classic batch used to rely solely on the lazy
    // seed-if-empty route in api/casino/games, which never fired once the
    // OTHER two batches' bootstrap migrations had already un-emptied the
    // table on the very same fresh start.
    runClassicBatch();
    runBetfairBatch();
    runCommonBatch();

    const rows = db.select().from(casinoGames).all();
    expect(rows).toHaveLength(
      CLASSIC_SEED_GAMES.length +
        BETFAIR_OFFER_ELIGIBLE_GAMES_2026_07_21.length +
        COMMON_UK_SLOTS_2026_07_21.length
    );
    const classicRow = db
      .select()
      .from(casinoGames)
      .where(eq(casinoGames.name, CLASSIC_SEED_GAMES[0].name))
      .get();
    expect(classicRow).toBeDefined();
  });

  it("is a no-op once its own marker is set - never resurrects a deleted row", () => {
    runBetfairBatch();
    db.delete(casinoGames).where(eq(casinoGames.name, "Betfair Live Baccarat")).run();

    const secondRun = runBetfairBatch();
    expect(secondRun).toBe(0);
    const row = db
      .select()
      .from(casinoGames)
      .where(eq(casinoGames.name, "Betfair Live Baccarat"))
      .get();
    expect(row).toBeUndefined();
  });

  it("re-running one batch never affects rows added by a different batch", () => {
    runBetfairBatch();
    runCommonBatch();
    db.delete(casinoGames).where(eq(casinoGames.name, "Dead or Alive")).run();

    runBetfairBatch(); // already marked done, no-op
    const row = db.select().from(casinoGames).where(eq(casinoGames.name, "Dead or Alive")).get();
    expect(row).toBeUndefined(); // still deleted - the Betfair batch never touches Common UK Slots rows
  });

  it("never overwrites a name that already exists, even before the marker is set", () => {
    db.insert(casinoGames)
      .values({
        name: "Betfair Live Baccarat",
        provider: "Evolution (Live)",
        rtp: 0.5,
        source: "user",
        updatedAt: Date.now(),
      })
      .run();

    runBetfairBatch();

    const row = db
      .select()
      .from(casinoGames)
      .where(eq(casinoGames.name, "Betfair Live Baccarat"))
      .get();
    expect(row?.rtp).toBe(0.5);
    expect(row?.source).toBe("user");
  });

  it("does not touch the three pre-existing titles the researched lists also name", () => {
    const now = Date.now();
    for (const name of ["Big Bass Bonanza", "Eye of Horus", "Fishin' Frenzy Lure 'Em In"]) {
      db.insert(casinoGames)
        .values({ name, provider: "seed", rtp: 0.123, source: "seed", updatedAt: now })
        .run();
    }

    runBetfairBatch();
    runCommonBatch();

    for (const name of ["Big Bass Bonanza", "Eye of Horus", "Fishin' Frenzy Lure 'Em In"]) {
      const row = db.select().from(casinoGames).where(eq(casinoGames.name, name)).get();
      expect(row?.rtp).toBe(0.123);
    }
  });
});
