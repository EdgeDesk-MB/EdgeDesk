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
