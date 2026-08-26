import { describe, expect, it } from "vitest";
import { nextLineTabIndex } from "./line-tabs-keyboard";

describe("nextLineTabIndex", () => {
  it("walks forward and leaves at the end", () => {
    expect(nextLineTabIndex(0, 4, false)).toBe(1);
    expect(nextLineTabIndex(3, 4, false)).toBeNull();
  });

  it("walks backward and leaves at the start", () => {
    expect(nextLineTabIndex(1, 4, true)).toBe(0);
    expect(nextLineTabIndex(0, 4, true)).toBeNull();
  });
});
