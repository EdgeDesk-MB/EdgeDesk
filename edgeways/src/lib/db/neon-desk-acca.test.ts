import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import type { AccaLegRow as PgAccaLegRow, AccaRunRow as PgAccaRunRow } from "@/lib/db/schema.pg";
import { accaLegs as pgAccaLegs, accaRuns as pgAccaRuns } from "@/lib/db/schema.pg";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  runs: [] as PgAccaRunRow[],
  legs: [] as PgAccaLegRow[],
  bets: [] as BetRow[],
  nextRunId: 1,
  nextLegId: 1,
  nextBetId: 1,
  insertedRuns: [] as Array<Record<string, unknown>>,
  insertedLegs: [] as Array<Record<string, unknown>>,
  betPatches: [] as Array<{ id: number; patch: Record<string, unknown> }>,
  settlements: [] as BetRow[],
}));

function columnName(col: unknown): string | null {
  if (!col || typeof col !== "object") return null;
  const c = col as { name?: string };
  return typeof c.name === "string" ? c.name : null;
}

function collectFilters(node: unknown, out: Record<string, unknown>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectFilters(item, out);
    return;
  }
  const n = node as { queryChunks?: unknown[] };
  if (Array.isArray(n.queryChunks)) {
    const chunks = n.queryChunks;
    for (let i = 0; i < chunks.length; i++) {
      const name = columnName(chunks[i]);
      if (name && i + 2 < chunks.length) {
        const val = chunks[i + 2];
        if (val != null && typeof val !== "object") {
          out[name] = val;
        } else if (val && typeof val === "object" && "value" in val) {
          out[name] = (val as { value: unknown }).value;
        }
      }
      collectFilters(chunks[i], out);
    }
  }
}

function toCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function matchesRow(row: Record<string, unknown>, cond: unknown): boolean {
  const filters: Record<string, unknown> = {};
  collectFilters(cond, filters);
  for (const [key, value] of Object.entries(filters)) {
    const actual = row[toCamel(key)] ?? row[key];
    if (actual !== value) return false;
  }
  return true;
}

function chainFor<T extends Record<string, unknown>>(rows: T[]) {
  let current = rows;
  const chain: {
    where: (cond: unknown) => typeof chain;
    orderBy: () => typeof chain;
    limit: (n: number) => typeof chain;
    then: (resolve: (v: T[]) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  } = {
    where: (cond: unknown) => {
      current = current.filter((row) => matchesRow(row, cond));
      return chain;
    },
    orderBy: () => chain,
    limit: (n: number) => {
      current = current.slice(0, n);
      return chain;
    },
    then: (resolve, reject) => Promise.resolve(current).then(resolve, reject),
  };
  return chain;
}

function bet(
  partial: Partial<BetRow> & Pick<BetRow, "id" | "label" | "betType">
): BetRow {
  return {
    eventId: null,
    market: "other",
    selection: "",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 7.2,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: null,
    actualProfit: null,
    notes: "Acca desk run - hedged on the exchange",
    balanceLedgered: 1,
    balanceSettled: 0,
    createdAt: 1,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: null,
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
  insertNeonDeskBet: async (values: Record<string, unknown>) => {
    const row = bet({
      id: mocks.nextBetId++,
      label: String(values.label ?? "Acca"),
      betType: String(values.betType ?? "qualifying"),
      backStake: Number(values.backStake ?? 0),
      backOdds: Number(values.backOdds ?? 0),
      layStake: Number(values.layStake ?? 0),
      layOdds: Number(values.layOdds ?? 0),
      commission: Number(values.commission ?? 0),
      notes: (values.notes as string | null) ?? null,
      bookmaker: (values.bookmaker as string | null) ?? null,
    });
    mocks.bets.push(row);
    return row;
  },
  getNeonDeskBet: async (id: number) => mocks.bets.find((b) => b.id === id) ?? null,
  listNeonDeskBets: async () => mocks.bets,
  patchNeonDeskBet: async (id: number, patch: Record<string, unknown>) => {
    const existing = mocks.bets.find((b) => b.id === id);
    if (!existing) return null;
    mocks.betPatches.push({ id, patch });
    Object.assign(existing, patch);
    return existing;
  },
}));

vi.mock("@/lib/db/neon-desk-ledger", () => ({
  ledgerNeonBetPlacement: async () => true,
  ledgerNeonBetSettlement: async (row: BetRow) => {
    mocks.settlements.push(row);
    return true;
  },
  logNeonLedgerFailure: () => {},
  reledgerNeonOpenBetPlacement: async () => {},
}));

vi.mock("@/lib/db/neon-events", () => ({
  getNeonEvent: async () => null,
}));

vi.mock("@/lib/db/neon-alerts-inbox", () => ({
  recordNeonAlerts: async () => 0,
}));

vi.mock("@/lib/services/push", () => ({
  sendPush: async () => {},
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = table === pgAccaRuns ? mocks.runs : mocks.legs;
        return chainFor(rows as unknown as Array<Record<string, unknown>>);
      },
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          if (table === pgAccaRuns) {
            mocks.insertedRuns.push(values);
            const row = {
              id: mocks.nextRunId++,
              offerId: null,
              wholeLayBetId: null,
              wholeLayStake: null,
              wholeLayOdds: null,
              muteAlerts: 0,
              status: "active",
              settledAt: null,
              commission: 0,
              noLay: 0,
              refundAmount: null,
              boostPct: null,
              backBetId: null,
              ...values,
            } as PgAccaRunRow;
            mocks.runs.push(row);
            return [row];
          }
          mocks.insertedLegs.push(values);
          const row = {
            id: mocks.nextLegId++,
            eventId: null,
            sport: null,
            market: null,
            selection: null,
            layOdds: null,
            layStake: null,
            layBetId: null,
            result: "pending",
            scheduledAt: null,
            ...values,
          } as PgAccaLegRow;
          mocks.legs.push(row);
          return [row];
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          const apply = () => {
            const store = table === pgAccaRuns ? mocks.runs : mocks.legs;
            const matched = store.filter((row) =>
              matchesRow(row as unknown as Record<string, unknown>, cond)
            );
            for (const row of matched) Object.assign(row, patch);
            return matched;
          };
          return {
            returning: async () => apply(),
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(apply()).then(resolve, reject),
          };
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (cond: unknown) => {
        if (table === pgAccaRuns) {
          mocks.runs = mocks.runs.filter(
            (row) => !matchesRow(row as unknown as Record<string, unknown>, cond)
          );
        } else {
          mocks.legs = mocks.legs.filter(
            (row) => !matchesRow(row as unknown as Record<string, unknown>, cond)
          );
        }
        return Promise.resolve();
      },
    }),
  }),
}));

import { createNeonAccaRun, setNeonLegResult } from "./neon-desk-acca";

describe("hosted Acca Desk", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.runs = [];
    mocks.legs = [];
    mocks.bets = [];
    mocks.nextRunId = 1;
    mocks.nextLegId = 1;
    mocks.nextBetId = 1;
    mocks.insertedRuns = [];
    mocks.insertedLegs = [];
    mocks.betPatches = [];
    mocks.settlements = [];
  });

  it("create stamps clerk_user_id on the run and legs", async () => {
    const { run, legs } = await createNeonAccaRun({
      label: "Saturday treble",
      method: "sequential",
      stake: 10,
      bookmaker: "Bet365",
      legs: [
        { label: "A", backOdds: 2 },
        { label: "B", backOdds: 2 },
      ],
    });
    expect(run.id).toBe(1);
    expect(legs).toHaveLength(2);
    expect(mocks.insertedRuns[0]).toEqual(
      expect.objectContaining({
        clerkUserId: "user_live",
        label: "Saturday treble",
        backBetId: 1,
      })
    );
    expect(mocks.insertedLegs).toHaveLength(2);
    expect(mocks.insertedLegs.every((leg) => leg.clerkUserId === "user_live")).toBe(true);
    expect(mocks.bets[0]?.notes).toBe("Acca desk run - hedged on the exchange");
    expect(mocks.bets[0]?.backOdds).toBe(4);
  });

  it("setLegResult lost sequential settles the cash back as −stake", async () => {
    mocks.runs.push({
      id: 8,
      offerId: null,
      label: "Test 3-fold",
      method: "sequential",
      stake: 10,
      bookmaker: "Bet365",
      commission: 0,
      refundAmount: null,
      backBetId: 40,
      wholeLayBetId: null,
      wholeLayStake: null,
      wholeLayOdds: null,
      boostPct: null,
      noLay: 0,
      muteAlerts: 0,
      status: "active",
      createdAt: 1,
      settledAt: null,
      clerkUserId: "user_live",
    });
    mocks.legs.push(
      {
        id: 21,
        runId: 8,
        seq: 1,
        label: "A",
        eventId: null,
        sport: null,
        market: null,
        selection: null,
        backOdds: 2,
        layOdds: null,
        layStake: null,
        layBetId: null,
        result: "pending",
        scheduledAt: null,
        clerkUserId: "user_live",
      },
      {
        id: 22,
        runId: 8,
        seq: 2,
        label: "B",
        eventId: null,
        sport: null,
        market: null,
        selection: null,
        backOdds: 2,
        layOdds: null,
        layStake: null,
        layBetId: null,
        result: "pending",
        scheduledAt: null,
        clerkUserId: "user_live",
      }
    );
    mocks.bets.push(
      bet({
        id: 40,
        label: "Acca · Test 3-fold",
        betType: "qualifying",
        backStake: 10,
        backOdds: 4,
      })
    );

    const out = await setNeonLegResult(21, "lost");
    expect(out?.runCompleted).toBe(true);
    expect(out?.leg.result).toBe("lost");

    const backPatch = mocks.betPatches.find((p) => p.id === 40);
    expect(backPatch?.patch).toEqual(
      expect.objectContaining({
        status: "lost",
        actualProfit: -10,
      })
    );
    expect(mocks.settlements.some((s) => s.id === 40 && s.status === "lost")).toBe(true);
    expect(mocks.runs[0]?.status).toBe("completed");
  });
});
