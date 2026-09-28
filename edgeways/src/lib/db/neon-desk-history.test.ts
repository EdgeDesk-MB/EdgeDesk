/**
 * EDGE-99 regression: history dedupe is scoped per user. The insert must
 * target the (clerk_user_id, dedupe) composite — a revert to bare `dedupe`
 * would reintroduce cross-user collisions and silent row loss on restore.
 *
 * EDGE-223: event commentary sync is batched, so a History load costs the
 * same few statements for 1 event or 100, and none once rows are current.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow, HistoryRow } from "@/lib/db/schema";

type Statement = {
  op: "insert" | "upsert" | "delete";
  rows: Array<Record<string, unknown>>;
  target?: unknown;
};

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_a" as string | null,
  capturedValues: undefined as Record<string, unknown> | undefined,
  capturedConflict: undefined as { target: unknown } | undefined,
  statements: [] as Statement[],
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const rows = Array.isArray(values) ? values : [values];
        if (!Array.isArray(values)) mocks.capturedValues = values;
        return {
          onConflictDoNothing: (conflict: { target: unknown }) => {
            mocks.capturedConflict = conflict;
            mocks.statements.push({ op: "insert", rows, target: conflict.target });
            return Promise.resolve();
          },
          onConflictDoUpdate: (conflict: { target: unknown }) => {
            mocks.statements.push({ op: "upsert", rows, target: conflict.target });
            return Promise.resolve();
          },
        };
      },
    }),
    delete: () => ({
      where: () => {
        mocks.statements.push({ op: "delete", rows: [] });
        return Promise.resolve();
      },
    }),
  }),
}));

import { insertNeonDeskHistory, syncNeonDeskEventHistory } from "@/lib/db/neon-desk-history";
import { history as pgHistory } from "@/lib/db/schema.pg";

describe("insertNeonDeskHistory (EDGE-99)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.capturedValues = undefined;
    mocks.capturedConflict = undefined;
  });

  it("targets the (clerk_user_id, dedupe) composite on conflict", async () => {
    await insertNeonDeskHistory({
      dedupe: "bet:1:placed",
      kind: "bet_placed",
      title: "Bet placed",
      createdAt: 1,
    });
    expect(mocks.capturedValues?.clerkUserId).toBe("user_a");
    expect(mocks.capturedConflict?.target).toEqual([
      pgHistory.clerkUserId,
      pgHistory.dedupe,
    ]);
  });

  it("writes nothing when signed out", async () => {
    mocks.clerkUserId = null;
    await insertNeonDeskHistory({
      dedupe: "bet:1:placed",
      kind: "bet_placed",
      title: "Bet placed",
      createdAt: 1,
    });
    expect(mocks.capturedValues).toBeUndefined();
  });
});

const START = Date.UTC(2026, 8, 20, 15);

function finishedMatch(id: number): EventRow {
  return {
    id,
    sport: "football",
    externalId: `fx-${id}`,
    competition: "Premier League",
    homeTeam: `Home ${id}`,
    awayTeam: `Away ${id}`,
    startTime: START + id * 60_000,
    status: "finished",
    homeScore: 2,
    awayScore: 0,
    minute: 90,
    homeLed2: 1,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify([
      { minute: 12, side: "home", player: "A. Striker" },
      { minute: 70, side: "home", player: "B. Winger" },
    ]),
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
    createdAt: START,
  };
}

/** What Neon would hold after the statements ran. */
function storedRows(statements: Statement[]): HistoryRow[] {
  const byDedupe = new Map<string, HistoryRow>();
  let id = 1;
  for (const statement of statements) {
    if (statement.op === "delete") continue;
    for (const values of statement.rows) {
      const dedupe = values.dedupe as string;
      if (statement.op === "insert" && byDedupe.has(dedupe)) continue;
      byDedupe.set(dedupe, {
        id: byDedupe.get(dedupe)?.id ?? id++,
        dedupe,
        kind: values.kind as HistoryRow["kind"],
        eventId: (values.eventId as number | undefined) ?? null,
        betId: (values.betId as number | undefined) ?? null,
        minute: (values.minute as number | undefined) ?? null,
        title: values.title as string,
        detail: (values.detail as string | undefined) ?? null,
        note: null,
        amount: (values.amount as number | undefined) ?? null,
        createdAt: values.createdAt as number,
      });
    }
  }
  return [...byDedupe.values()];
}

describe("syncNeonDeskEventHistory (EDGE-223)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.statements = [];
  });

  it("uses the same few statements for 1 event or 100", async () => {
    await syncNeonDeskEventHistory([finishedMatch(1)], []);
    const one = mocks.statements.map((s) => s.op);
    mocks.statements = [];

    const events = Array.from({ length: 100 }, (_, i) => finishedMatch(i + 1));
    const written = await syncNeonDeskEventHistory(events, []);
    expect(mocks.statements.map((s) => s.op)).toEqual(one);
    expect(one.length).toBeLessThanOrEqual(3);
    const upserts = mocks.statements.find((s) => s.op === "upsert")!;
    const inserts = mocks.statements.find((s) => s.op === "insert")!;
    expect(inserts.rows).toHaveLength(100);
    expect(upserts.rows.length).toBeGreaterThanOrEqual(300);
    expect(written).toBeGreaterThanOrEqual(400);
    for (const statement of [inserts, upserts]) {
      expect(statement.target).toEqual([pgHistory.clerkUserId, pgHistory.dedupe]);
      expect(statement.rows.every((row) => row.clerkUserId === "user_a")).toBe(true);
    }
  });

  it("writes nothing once the stored rows already match", async () => {
    const events = Array.from({ length: 25 }, (_, i) => finishedMatch(i + 1));
    await syncNeonDeskEventHistory(events, []);
    const stored = storedRows(mocks.statements);
    mocks.statements = [];

    expect(await syncNeonDeskEventHistory(events, stored)).toBe(0);
    expect(mocks.statements).toEqual([]);
  });

  it("refreshes only the row that changed", async () => {
    const events = [finishedMatch(1), finishedMatch(2)];
    await syncNeonDeskEventHistory(events, []);
    const stored = storedRows(mocks.statements).map((row) =>
      row.dedupe === "goal:2:1" ? { ...row, title: "Goal!" } : row
    );
    mocks.statements = [];

    expect(await syncNeonDeskEventHistory(events, stored)).toBe(1);
    expect(mocks.statements).toHaveLength(1);
    expect(mocks.statements[0]!.op).toBe("upsert");
    expect(mocks.statements[0]!.rows.map((row) => row.dedupe)).toEqual(["goal:2:1"]);
  });

  it("still upserts when the caller only knows dedupe keys", async () => {
    const events = [finishedMatch(1)];
    await syncNeonDeskEventHistory(events, []);
    const keys = storedRows(mocks.statements).map(({ eventId, dedupe }) => ({ eventId, dedupe }));
    mocks.statements = [];

    await syncNeonDeskEventHistory(events, keys);
    expect(mocks.statements.map((s) => s.op)).toEqual(["upsert"]);
  });
});
