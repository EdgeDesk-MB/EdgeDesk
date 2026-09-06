import { describe, expect, it, vi } from "vitest";
import type { EventRow, HistoryRow } from "@/lib/db/schema";

const mockRun = vi.fn();
const mockWhere = vi.fn(() => ({ run: mockRun }));
// Loosely typed: tests swap in select-shaped returns ({ all }) per call.
const mockFrom = vi.fn<(...args: unknown[]) => unknown>(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockDelete = vi.fn(() => ({ where: mockWhere }));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
  },
  history: { betId: "bet_id", id: "id" },
  events: {},
  bets: { id: "id" },
}));

describe("purgeHistoryForBet", () => {
  it("deletes history rows for the bet id", async () => {
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        all: () => [
          { id: 1, betId: 7 },
          { id: 2, betId: 7 },
        ],
      })),
    });

    const { purgeHistoryForBet } = await import("./history-feed");
    const removed = purgeHistoryForBet(7);

    expect(removed).toBe(2);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("purgeOrphanedBetHistory", () => {
  it("deletes history rows when the bet no longer exists", async () => {
    mockFrom
      .mockReturnValueOnce({ all: () => [{ id: 1 }, { id: 2 }] })
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          all: () => [
            { id: 10, betId: 1 },
            { id: 11, betId: 99 },
          ],
        })),
      });

    const { purgeOrphanedBetHistory } = await import("./history-feed");
    const removed = purgeOrphanedBetHistory();

    expect(removed).toBe(1);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("dedupeHistoryForDisplay", () => {
  it("drops nameless Goal! ticks once the tape covers that scoreline", async () => {
    const { dedupeHistoryForDisplay } = await import("./history-feed");
    const event = {
      id: 9,
      goals: JSON.stringify([
        { kind: "goal", minute: 42, side: "home", player: "Cesar Palacios Perez" },
      ]),
    } as EventRow;
    const named = {
      id: 1,
      dedupe: "goal:9:0",
      kind: "goal",
      title: "Goal: Cesar Palacios Perez!",
      eventId: 9,
    } as HistoryRow;
    const leftover = {
      id: 2,
      dedupe: "score:9:1-0",
      kind: "goal",
      title: "Goal!",
      eventId: 9,
    } as HistoryRow;
    const keptTick = {
      id: 3,
      dedupe: "score:9:2-1",
      kind: "goal",
      title: "Goal!",
      eventId: 9,
    } as HistoryRow;

    expect(
      dedupeHistoryForDisplay([named, leftover, keptTick], [event]).map((row) => row.dedupe)
    ).toEqual(["goal:9:0", "score:9:2-1"]);
  });

  it("drops a 1-1 tick when a named goal row already has that scoreline", async () => {
    const { dedupeHistoryForDisplay } = await import("./history-feed");
    const named = {
      id: 1,
      dedupe: "goal:69:1",
      kind: "goal",
      title: "Goal: Jay Stansfield!",
      eventId: 69,
      detail: "Birmingham 1-1 Wolves",
    } as HistoryRow;
    const leftover = {
      id: 2,
      dedupe: "score:69:1-1",
      kind: "goal",
      title: "Goal!",
      eventId: 69,
      detail: "Birmingham 1-1 Wolves",
    } as HistoryRow;
    expect(
      dedupeHistoryForDisplay([named, leftover], [{ id: 69, goals: null } as EventRow]).map(
        (row) => row.dedupe
      )
    ).toEqual(["goal:69:1"]);
  });
});
