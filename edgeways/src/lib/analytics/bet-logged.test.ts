import { describe, expect, it } from "vitest";
import { betLoggedProperties } from "@/lib/analytics/bet-logged";

describe("bet_logged properties", () => {
  it("sends source and is_first only", () => {
    expect(betLoggedProperties({ source: "slip_import", isFirst: true })).toEqual({
      source: "slip_import",
      is_first: true,
    });
    expect(
      Object.keys(betLoggedProperties({ source: "bet_builder", isFirst: false }))
    ).toEqual(["source", "is_first"]);
  });
});
