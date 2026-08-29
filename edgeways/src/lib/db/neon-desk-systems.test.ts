import { beforeEach, describe, expect, it, vi } from "vitest";
import { settleSystemReturns } from "@/lib/calc/systems-settle";
import type { BetRow } from "@/lib/db/schema";
import { systemRuns as pgSystemRuns } from "@/lib/db/schema.pg";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_a" as string | null,
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  betValues: undefined as Record<string, unknown> | undefined,
  nextBetId: 99,
}));

function betRow(partial: Partial<BetRow> & Pick<BetRow, "id" | "label">): BetRow {
  return {
    eventId: null,
    market: "other",
    selection: "",
    betType: "qualifying",
    bookmaker: null,
    exchangeId: null,
    backStake: 0,
    backOdds: 0,
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
    notes: "Systems desk · Yankee · ev_play",
    balanceLedgered: 0,
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
    mocks.betValues = values;
    return betRow({
      id: mocks.nextBetId,
      label: String(values.label ?? "System"),
      betType: String(values.betType ?? "qualifying"),
      backStake: Number(values.backStake ?? 0),
      backOdds: Number(values.backOdds ?? 0),
      notes: typeof values.notes === "string" ? values.notes : null,
      bookmaker: typeof values.bookmaker === "string" ? values.bookmaker : null,
    });
  },
  listNeonDeskBets: async () => [],
  getNeonDeskBet: async () => null,
  patchNeonDeskBet: async () => null,
}));

vi.mock("@/lib/db/neon-desk-ledger", () => ({
  ledgerNeonBetPlacement: async () => true,
  ledgerNeonBetSettlement: async () => true,
  reledgerNeonOpenBetPlacement: async () => {},
  logNeonLedgerFailure: () => {},
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserts.push({ table, values });
        const row = {
          id: mocks.inserts.length,
          status: "active",
          result: "pending",
          ...values,
        };
        return {
          returning: async () => [row],
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
          orderBy: async () => [],
        }),
      }),
    }),
  }),
}));

import {
  createNeonSystemRun,
  hostedSystemLinkedSettlement,
} from "./neon-desk-systems";

const yankeeLegs = [
  { label: "A", oddsDecimal: 2 },
  { label: "B", oddsDecimal: 2 },
  { label: "C", oddsDecimal: 2 },
  { label: "D", oddsDecimal: 5 },
];

describe("createNeonSystemRun clerk scoping", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.inserts = [];
    mocks.betValues = undefined;
  });

  it("stamps clerk_user_id on the run and every leg", async () => {
    const created = await createNeonSystemRun({
      label: "Clerk yankee",
      structure: "yankee",
      unitStake: 1,
      legs: yankeeLegs,
    });
    expect(created.run.label).toBe("Clerk yankee");
    expect(created.legs).toHaveLength(4);
    const runInsert = mocks.inserts.find((row) => row.table === pgSystemRuns);
    expect(runInsert?.values).toMatchObject({
      clerkUserId: "user_a",
      label: "Clerk yankee",
      backBetId: 99,
    });
    const legInserts = mocks.inserts.filter((row) => row.table !== pgSystemRuns);
    expect(legInserts).toHaveLength(4);
    expect(legInserts.every((row) => row.values.clerkUserId === "user_a")).toBe(
      true
    );
    expect(mocks.betValues?.notes).toContain("Systems desk");
  });

  it("refuses to write when signed out", async () => {
    mocks.clerkUserId = null;
    await expect(
      createNeonSystemRun({
        label: "No clerk",
        structure: "yankee",
        unitStake: 1,
        legs: yankeeLegs,
      })
    ).rejects.toThrow(/Sign in/);
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.betValues).toBeUndefined();
  });
});

describe("hostedSystemLinkedSettlement", () => {
  it("writes settleSystemReturns profit for a cash yankee with one void", () => {
    const legs = [
      { label: "A", oddsDecimal: 2, result: "won" as const },
      { label: "B", oddsDecimal: 2, result: "won" as const },
      { label: "C", oddsDecimal: 2, result: "won" as const },
      { label: "D", oddsDecimal: 5, result: "void" as const },
    ];
    const settled = settleSystemReturns("yankee", 1, legs, {});
    expect(settled).not.toBeNull();
    expect(
      hostedSystemLinkedSettlement(
        { structure: "yankee", unitStake: 1, eachWay: 0, placeFraction: null },
        legs,
        "qualifying"
      )
    ).toEqual({
      status: settled!.returns > 0 ? "won" : "lost",
      profit: settled!.profit,
    });
  });

  it("writes settleSystemReturns profit when an each-way leg is placed", () => {
    const legs = [
      { label: "A", oddsDecimal: 3, result: "won" as const },
      { label: "B", oddsDecimal: 4, result: "placed" as const },
      { label: "C", oddsDecimal: 2.5, result: "lost" as const },
    ];
    const settled = settleSystemReturns("patent", 2, legs, {
      eachWay: true,
      placeFraction: 0.2,
    });
    expect(settled).not.toBeNull();
    expect(
      hostedSystemLinkedSettlement(
        { structure: "patent", unitStake: 2, eachWay: 1, placeFraction: 0.2 },
        legs,
        "qualifying"
      )
    ).toEqual({
      status: settled!.returns > 0 ? "won" : "lost",
      profit: settled!.profit,
    });
  });

  it("derives free_snr profit from settleSystemReturns line counts", () => {
    const legs = [
      { label: "A", oddsDecimal: 3, result: "won" as const },
      { label: "B", oddsDecimal: 4, result: "lost" as const },
      { label: "C", oddsDecimal: 3, result: "lost" as const },
      { label: "D", oddsDecimal: 2, result: "lost" as const },
    ];
    const settled = settleSystemReturns("lucky_15", 1, legs, {});
    expect(settled).not.toBeNull();
    const refunds = settled!.refundedLines * 1;
    const expected = settled!.returns - refunds - settled!.winPayingLines * 1;
    expect(
      hostedSystemLinkedSettlement(
        { structure: "lucky_15", unitStake: 1, eachWay: 0, placeFraction: null },
        legs,
        "free_snr"
      )
    ).toEqual({
      status: settled!.returns > 0 ? "won" : "lost",
      profit: expected,
    });
  });
});
