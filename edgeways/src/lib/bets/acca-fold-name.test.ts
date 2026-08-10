import { describe, expect, it } from "vitest";
import { accaFoldName, accaFoldNameFromResults } from "./acca-fold-name";

describe("accaFoldName", () => {
  it("uses Double / Treble for 2 and 3", () => {
    expect(accaFoldName(2)).toBe("Double");
    expect(accaFoldName(3)).toBe("Treble");
  });

  it("uses hyphenated N-fold from four upwards", () => {
    expect(accaFoldName(4)).toBe("Four-fold");
    expect(accaFoldName(5)).toBe("Five-fold");
    expect(accaFoldName(6)).toBe("Six-fold");
    expect(accaFoldName(8)).toBe("Eight-fold");
    expect(accaFoldName(12)).toBe("Twelve-fold");
    expect(accaFoldName(13)).toBe("13-fold");
  });

  it("returns null below a multiple", () => {
    expect(accaFoldName(0)).toBeNull();
    expect(accaFoldName(1)).toBeNull();
  });
});

describe("accaFoldNameFromResults", () => {
  it("drops void legs from the fold size", () => {
    expect(
      accaFoldNameFromResults([
        { result: "won" },
        { result: "void" },
        { result: "pending" },
      ])
    ).toBe("Double");
  });
});
