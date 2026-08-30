/**
 * EDGE-98: the hosted backup must carry bet import_fingerprint/import_meta
 * and restore must write them back, or a CSV re-import after a restore
 * duplicates every imported bet (re-import idempotency keys on the
 * fingerprint).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_a" as string | null,
  rowsByTable: new Map<unknown, Record<string, unknown>[]>(),
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
  idSeq: 0,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = mocks.rowsByTable.get(table) ?? [];
          const p = Promise.resolve(rows) as Promise<unknown[]> & {
            limit: () => Promise<unknown[]>;
          };
          p.limit = () => Promise.resolve([]);
          return p;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserts.push({ table, values });
        const row = [{ id: ++mocks.idSeq }];
        return {
          returning: () => Promise.resolve(row),
          onConflictDoNothing: () => ({ returning: () => Promise.resolve(row) }),
        };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  }),
}));

import {
  neonDeskBackupBundle,
  restoreNeonDeskBackup,
} from "@/lib/db/neon-desk-backup";
import {
  bets as pgBets,
  offerEvSnapshots as pgOfferEvSnapshots,
  offerSeries as pgOfferSeries,
  offers as pgOffers,
} from "@/lib/db/schema.pg";

const BET_ROW = {
  id: 7,
  clerkUserId: "user_a",
  label: "Arsenal v Chelsea",
  market: "match_odds",
  selection: "Arsenal",
  betType: "qualifying",
  backStake: 10,
  backOdds: 2.5,
  layStake: 9.8,
  layOdds: 2.6,
  commission: 0.02,
  status: "won",
  createdAt: 1,
  source: "import",
  importFingerprint: "fp-abc123",
  importMeta: "{\"row\":42}",
};

describe("hosted backup/restore bet fingerprints (EDGE-98)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.rowsByTable = new Map();
    mocks.inserts = [];
    mocks.idSeq = 0;
  });

  it("backup serialises import_fingerprint and import_meta", async () => {
    mocks.rowsByTable.set(pgBets, [BET_ROW]);
    const bundle = await neonDeskBackupBundle();
    expect(bundle.tables.bets).toHaveLength(1);
    expect(bundle.tables.bets[0].import_fingerprint).toBe("fp-abc123");
    expect(bundle.tables.bets[0].import_meta).toBe("{\"row\":42}");
  });

  it("restore writes the fingerprint back onto the bet row", async () => {
    const counts = await restoreNeonDeskBackup({
      accounts: [{ id: 1, name: "Betfair", type: "exchange" }],
      bets: [
        {
          id: 7,
          label: "Arsenal v Chelsea",
          import_fingerprint: "fp-abc123",
          import_meta: "{\"row\":42}",
        },
      ],
    });
    expect(counts.bets).toBe(1);
    const betInsert = mocks.inserts.find((i) => i.table === pgBets);
    expect(betInsert?.values.importFingerprint).toBe("fp-abc123");
    expect(betInsert?.values.importMeta).toBe("{\"row\":42}");
  });

  it("restore tolerates older backups without fingerprint columns", async () => {
    const counts = await restoreNeonDeskBackup({
      bets: [{ id: 7, label: "Arsenal v Chelsea" }],
    });
    expect(counts.bets).toBe(1);
    const betInsert = mocks.inserts.find((i) => i.table === pgBets);
    expect(betInsert?.values.importFingerprint).toBeNull();
    expect(betInsert?.values.importMeta).toBeNull();
  });
});

const SERIES_ROW = {
  id: 4,
  clerkUserId: "user_a",
  recurrenceEnabled: 1,
  recurrenceStoppedFrom: null,
  skippedDatesJson: '["2026-08-01"]',
  ruleJson: '{"freq":"daily"}',
  templateExpiresAt: 1,
  horizonDays: 14,
  bookmaker: "Sky",
  title: "Daily extra",
  description: null,
  expectedProfit: 2.5,
  sport: "horse_racing",
  offerType: "extra_place",
  scopeCourse: null,
  scopeRaceId: null,
  scopeRaceLabel: null,
  rules: '{"steps":[]}',
  offerUrl: "https://example.test/promo",
  createdAt: 1,
  updatedAt: 2,
};

const SNAPSHOT_ROW = {
  id: 9,
  clerkUserId: "user_a",
  offerId: 12,
  version: 1,
  lockedAt: 100,
  expectedProfit: 4.2,
  basis: "live",
  inputsJson: '{"autoLocked":true}',
  realizedProfit: 3.8,
  capturePct: 90,
  commissionDrag: 0.1,
  settledAt: 200,
  mistakeTag: "laid_late",
};

describe("hosted backup/restore series and EV snapshots", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.rowsByTable = new Map();
    mocks.inserts = [];
    mocks.idSeq = 0;
  });

  it("backup serialises offer_series and offer_ev_snapshots", async () => {
    mocks.rowsByTable.set(pgOfferSeries, [SERIES_ROW]);
    mocks.rowsByTable.set(pgOfferEvSnapshots, [SNAPSHOT_ROW]);
    const bundle = await neonDeskBackupBundle();
    expect(bundle.tables.offer_series).toHaveLength(1);
    expect(bundle.tables.offer_series[0].rule_json).toBe('{"freq":"daily"}');
    expect(bundle.tables.offer_series[0].skipped_dates_json).toBe('["2026-08-01"]');
    expect(bundle.tables.offer_ev_snapshots).toHaveLength(1);
    expect(bundle.tables.offer_ev_snapshots[0].mistake_tag).toBe("laid_late");
    expect(bundle.tables.offer_ev_snapshots[0].expected_profit).toBe(4.2);
  });

  it("restore remaps series onto offers and snapshots onto new offer ids", async () => {
    const counts = await restoreNeonDeskBackup({
      offer_series: [
        {
          id: 4,
          title: "Daily extra",
          rule_json: '{"freq":"daily"}',
          skipped_dates_json: '["2026-08-01"]',
        },
      ],
      offers: [
        { id: 12, title: "Tuesday extra", series_id: 4, instance_date: "2026-08-04" },
      ],
      offer_ev_snapshots: [
        {
          offer_id: 12,
          version: 1,
          locked_at: 100,
          expected_profit: 4.2,
          basis: "live",
          mistake_tag: "laid_late",
          settled_at: 200,
        },
      ],
    });
    expect(counts.offer_series).toBe(1);
    expect(counts.offers).toBe(1);
    expect(counts.offer_ev_snapshots).toBe(1);

    const seriesInsert = mocks.inserts.find((i) => i.table === pgOfferSeries);
    expect(seriesInsert?.values.clerkUserId).toBe("user_a");
    expect(seriesInsert?.values.ruleJson).toBe('{"freq":"daily"}');
    expect(seriesInsert?.values.skippedDatesJson).toBe('["2026-08-01"]');

    const offerInsert = mocks.inserts.find((i) => i.table === pgOffers);
    expect(offerInsert?.values.seriesId).toBe(1);
    expect(offerInsert?.values.instanceDate).toBe("2026-08-04");

    const snapInsert = mocks.inserts.find((i) => i.table === pgOfferEvSnapshots);
    expect(snapInsert?.values.clerkUserId).toBe("user_a");
    expect(snapInsert?.values.offerId).toBe(2);
    expect(snapInsert?.values.mistakeTag).toBe("laid_late");
    expect(snapInsert?.values.settledAt).toBe(200);
  });

  it("restore skips a snapshot whose offer did not restore", async () => {
    const counts = await restoreNeonDeskBackup({
      offer_ev_snapshots: [
        {
          offer_id: 99,
          version: 1,
          locked_at: 100,
          expected_profit: 1,
          basis: "live",
        },
      ],
    });
    expect(counts.offer_ev_snapshots).toBe(0);
    expect(mocks.inserts.some((i) => i.table === pgOfferEvSnapshots)).toBe(false);
  });

  it("restore tolerates older backups without series or snapshots", async () => {
    const counts = await restoreNeonDeskBackup({
      offers: [{ id: 1, title: "One-off" }],
    });
    expect(counts.offer_series).toBe(0);
    expect(counts.offer_ev_snapshots).toBe(0);
    expect(counts.offers).toBe(1);
    const offerInsert = mocks.inserts.find((i) => i.table === pgOffers);
    expect(offerInsert?.values.seriesId).toBeNull();
  });
});
