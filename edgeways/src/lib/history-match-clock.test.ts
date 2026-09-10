import { describe, expect, it } from "vitest";
import { lastMatchTapeMinute, regulationEndMinute } from "./history-match-clock";

describe("lastMatchTapeMinute", () => {
  it("reads the latest kick on the tape", () => {
    expect(regulationEndMinute("ft")).toBe(90);
    expect(regulationEndMinute("aet")).toBe(120);
    expect(
      lastMatchTapeMinute(
        JSON.stringify([
          { kind: "goal", minute: 48, side: "home" },
          { kind: "goal", minute: 94, side: "home" },
        ])
      )
    ).toBe(94);
  });
});
