import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  bets: [] as BetRow[],
  runs: [] as Array<Record<string, unknown>>,
  selections: [] as Array<Record<string, unknown>>,
  nextBetId: 1,
  nextRunId: 1,
  nextSelId: 1,
}));

function betRow(values: Record<string, unknown>): BetRow {
  return {
    id: mocks.nextBetId++,
    eventId: (values.eventId as number | null) ?? null,
    label: String(values.label),
    market: String(values.market ?? "other"),
    selection: String(values.selection ?? ""),
    betType: String(values.betType ?? "qualifying"),
    bookmaker: (values.bookmaker as string | null) ?? null,
    exchangeId: (values.exchangeId as number | null) ?? null,
    backStake: Number(values.backStake ?? 0),
    backOdds: Number(values.backOdds ?? 0),
    layStake: Number(values.layStake ?? 0),
    layOdds: Number(values.layOdds ?? 0),
    commission: Number(values.commission ?? 0),
    earlyPayout: Number(values.earlyPayout ?? 0),
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: null,
    actualProfit: null,
    notes: (values.notes as string | null) ?? null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: Number(values.createdAt ?? 1),
    settledAt: null,
    offerId: (values.offerId as number | null) ?? null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: (values.sport as string | null) ?? null,
    importFingerprint: null,
    importMeta: null,
  };
}

function asQuery<T>(rows: T[]) {
  const exec = Promise.resolve(rows);
  return {
    where: () => asQuery(rows),
    orderBy: () => asQuery(rows),
    limit: (n: number) => asQuery(rows.slice(0, n)),
    then: exec.then.bind(exec),
    catch: exec.catch.bind(exec),
  };
}

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
  insertNeonDeskBet: async (values: Record<string, unknown>) => {
    const row = betRow(values);
    mocks.bets.push(row);
    return row;
  },
  getNeonDeskBet: async (id: number) => mocks.bets.find((b) => b.id === id) ?? null,
  listNeonDeskBets: async () =>
    mocks.clerkUserId
      ? mocks.bets
      : [],
  patchNeonDeskBet: async (id: number, patch: Partial<BetRow>) => {
    const row = mocks.bets.find((b) => b.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  },
}));

vi.mock("@/lib/db/neon-desk-ledger", () => ({
  ledgerNeonBetPlacement: async () => true,
  ledgerNeonBetSettlement: async () => true,
  logNeonLedgerFailure: () => {},
  reledgerNeonOpenBetPlacement: async () => {},
}));

vi.mock("@/lib/db/neon", async () => {
  const { getTableName } = await import("drizzle-orm");
  return {
    getNeonDb: () => ({
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const name = getTableName(table as never);
          if (name === "bet_builder_runs") {
            const row = {
              id: mocks.nextRunId++,
              muteAlerts: 0,
              status: "active",
              settledAt: null,
              wholeLayBetId: null,
              wholeLayStake: null,
              wholeLayOdds: null,
              ...values,
            };
            mocks.runs.push(row);
            return { returning: async () => [row] };
          }
          if (name === "bet_builder_selections") {
            const row = {
              id: mocks.nextSelId++,
              result: "pending",
              ...values,
            };
            mocks.selections.push(row);
            return { returning: async () => [row] };
          }
          return { returning: async () => [] };
        },
      }),
      select: () => ({
        from: (table: unknown) => {
          const name = getTableName(table as never);
          const rows =
            name === "bet_builder_runs"
              ? mocks.runs.filter((r) => r.clerkUserId === mocks.clerkUserId)
              : name === "bet_builder_selections"
                ? mocks.selections.filter((s) => s.clerkUserId === mocks.clerkUserId)
                : [];
          return asQuery(rows);
        },
      }),
      update: (table: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => {
            const name = getTableName(table as never);
            const list =
              name === "bet_builder_runs" ? mocks.runs : mocks.selections;
            const row = list.find((r) => r.clerkUserId === mocks.clerkUserId);
            if (row) Object.assign(row, patch);
            return {
              returning: async () => (row ? [row] : []),
            };
          },
        }),
      }),
      delete: () => ({
        where: async () => {},
      }),
    }),
  };
});

import {
  createNeonBetBuilderRun,
  listNeonBetBuilderRuns,
} from "./neon-desk-bet-builder";

describe("hosted bet builder desk", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.bets = [];
    mocks.runs = [];
    mocks.selections = [];
    mocks.nextBetId = 1;
    mocks.nextRunId = 1;
    mocks.nextSelId = 1;
  });

  it("scopes list and create to the signed-in Clerk user", async () => {
    mocks.clerkUserId = null;
    await expect(listNeonBetBuilderRuns()).resolves.toEqual([]);
    await expect(
      createNeonBetBuilderRun({
        label: "Unsigned",
        method: "no_lay",
        stake: 10,
        backOdds: 4,
        selections: [{ label: "Home" }, { label: "BTTS" }],
      })
    ).rejects.toThrow(/Sign in/);

    mocks.clerkUserId = "user_live";
    await createNeonBetBuilderRun({
      label: "Arsenal BB",
      method: "no_lay",
      stake: 10,
      backOdds: 4,
      selections: [{ label: "Home" }, { label: "BTTS" }],
    });
    expect(mocks.runs[0]?.clerkUserId).toBe("user_live");
    expect(mocks.selections.every((s) => s.clerkUserId === "user_live")).toBe(true);

    mocks.clerkUserId = "user_other";
    await expect(listNeonBetBuilderRuns()).resolves.toEqual([]);
  });

  it("no-lay create does not invent a lay bet", async () => {
    const { run, selections } = await createNeonBetBuilderRun({
      label: "Cash BB",
      method: "no_lay",
      stake: 5,
      backOdds: 6,
      bookmaker: "Sky Bet",
      selections: [{ label: "Home" }, { label: "BTTS" }],
      wholeLay: { layOdds: 5.5, layStake: 9.26 },
    });
    expect(selections).toHaveLength(2);
    expect(run.method).toBe("no_lay");
    expect(run.wholeLayBetId).toBeNull();
    expect(run.wholeLayStake).toBeNull();
    expect(run.wholeLayOdds).toBeNull();
    expect(mocks.bets).toHaveLength(1);
    expect(mocks.bets[0]?.betType).toBe("qualifying");
    expect(mocks.bets[0]?.layStake).toBe(0);
    expect(mocks.bets[0]?.layOdds).toBe(0);
    expect(mocks.bets.some((b) => b.betType === "lay_only")).toBe(false);
  });
});
