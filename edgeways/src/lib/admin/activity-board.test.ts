import { describe, expect, it } from "vitest";
import {
  activityBoardFromPreset,
  DEFAULT_ACTIVITY_BOARD,
  moveActivityWidget,
  parseActivityBoard,
  serializeActivityBoard,
} from "@/lib/admin/activity-board";

describe("activity board", () => {
  it("defaults to pins beside desk activity", () => {
    expect(DEFAULT_ACTIVITY_BOARD.order.slice(0, 2)).toEqual([
      "pins",
      "timeline",
    ]);
    expect(parseActivityBoard(null)).toEqual(DEFAULT_ACTIVITY_BOARD);
  });

  it("applies a named focus and ignores a stale custom order", () => {
    const parsed = parseActivityBoard(
      JSON.stringify({
        preset: "volume",
        order: ["desks", "pins"],
      })
    );
    expect(parsed).toEqual(activityBoardFromPreset("volume"));
    expect(parsed.order[0]).toBe("timeline");
  });

  it("keeps a custom order and fills missing widgets", () => {
    const parsed = parseActivityBoard(
      JSON.stringify({ preset: "custom", order: ["desks", "pins"] })
    );
    expect(parsed.preset).toBe("custom");
    expect(parsed.order[0]).toBe("desks");
    expect(parsed.order).toContain("timeline");
    expect(parsed.order).toHaveLength(5);
  });

  it("moves a widget and marks the board custom", () => {
    const moved = moveActivityWidget(
      activityBoardFromPreset("pins").order,
      "pins",
      1
    );
    expect(moved.preset).toBe("custom");
    expect(moved.order.slice(0, 2)).toEqual(["timeline", "pins"]);
  });

  it("round-trips a stored layout", () => {
    const raw = serializeActivityBoard({
      preset: "mix",
      order: ["categories"],
    });
    expect(parseActivityBoard(raw).preset).toBe("mix");
    expect(parseActivityBoard(raw).order[0]).toBe("categories");
  });
});
