import { describe, expect, it } from "vitest";
import { pruneLiveDockLocks, toggleLockId } from "@/lib/ui/live-dock-prefs";

describe("live-dock-prefs", () => {
  it("toggleLockId adds and removes", () => {
    expect(toggleLockId([], 3)).toEqual([3]);
    expect(toggleLockId([1, 3], 3)).toEqual([1]);
  });

  it("pruneLiveDockLocks drops stale ids", () => {
    const next = pruneLiveDockLocks(
      { events: [1, 2, 9], positions: [10, 11] },
      [1, 9],
      [11]
    );
    expect(next).toEqual({ events: [1, 9], positions: [11] });
  });
});
