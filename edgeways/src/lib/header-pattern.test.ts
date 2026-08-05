import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_IDS,
  HEADER_PATTERN_OPTIONS,
  isHeaderPatternId,
  normalizeHeaderPattern,
} from "@/lib/header-pattern";

describe("header-pattern", () => {
  it("defaults to diagonal-lines", () => {
    expect(DEFAULT_HEADER_PATTERN).toBe("diagonal-lines");
    expect(normalizeHeaderPattern(undefined)).toBe("diagonal-lines");
    expect(normalizeHeaderPattern("nope")).toBe("diagonal-lines");
  });

  it("exposes twelve Hero Pattern options", () => {
    expect(HEADER_PATTERN_IDS).toHaveLength(12);
    expect(HEADER_PATTERN_OPTIONS).toHaveLength(12);
    expect(HEADER_PATTERN_OPTIONS[0]?.id).toBe("diagonal-lines");
    for (const opt of HEADER_PATTERN_OPTIONS) {
      expect(isHeaderPatternId(opt.id)).toBe(true);
    }
  });

  it("accepts known ids", () => {
    expect(normalizeHeaderPattern("hexagons")).toBe("hexagons");
    expect(isHeaderPatternId("bank-note")).toBe(true);
  });
});
