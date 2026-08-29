import { describe, expect, it } from "vitest";
import { priceMovementFromHistory } from "./racing-odds-snapshots";

describe("priceMovementFromHistory", () => {
  it("returns empty movement when there is no history", () => {
    expect(priceMovementFromHistory([])).toEqual({
      open: null,
      current: null,
      change: null,
      changePct: null,
      history: [],
      snapshotCount: 0,
    });
  });

  it("treats a steamer as a negative change from the first snapshot", () => {
    const movement = priceMovementFromHistory([5, 4.5, 4]);
    expect(movement.open).toBe(5);
    expect(movement.current).toBe(4);
    expect(movement.change).toBe(-1);
    expect(movement.changePct).toBe(-20);
    expect(movement.snapshotCount).toBe(3);
  });

  it("keeps only the last 12 prices in the sparkline", () => {
    const history = Array.from({ length: 20 }, (_, i) => 2 + i * 0.1);
    const movement = priceMovementFromHistory(history);
    expect(movement.history).toHaveLength(12);
    expect(movement.snapshotCount).toBe(20);
    expect(movement.history[0]).toBe(history[8]);
    expect(movement.history.at(-1)).toBe(history.at(-1));
  });
});
