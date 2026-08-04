import { describe, expect, it, vi } from "vitest";

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
