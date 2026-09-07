import { describe, expect, it } from "vitest";
import { normalizeTemporalValue } from "@/components/native-temporal-field";

describe("normalizeTemporalValue", () => {
  it("keeps date as YYYY-MM-DD", () => {
    expect(normalizeTemporalValue("date", "2026-09-07")).toBe("2026-09-07");
  });

  it("strips seconds from time and datetime-local", () => {
    expect(normalizeTemporalValue("time", "17:30:45")).toBe("17:30");
    expect(normalizeTemporalValue("datetime-local", "2026-09-07T17:30:45")).toBe(
      "2026-09-07T17:30"
    );
  });

  it("treats blank as empty", () => {
    expect(normalizeTemporalValue("time", "  ")).toBe("");
    expect(normalizeTemporalValue("datetime-local", "")).toBe("");
  });
});
