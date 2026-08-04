import { describe, expect, it } from "vitest";
import { formatGbp, roundMoney } from "@/lib/format-money";

describe("format-money", () => {
  it("rounds to pence", () => {
    expect(roundMoney(449.625)).toBe(449.63);
    expect(roundMoney(101.624999)).toBe(101.62);
  });

  it("formats with two decimal places", () => {
    expect(formatGbp(551.2)).toBe("£551.20");
    expect(formatGbp(28.6)).toBe("£28.60");
  });

  it("formats signed deltas", () => {
    expect(formatGbp(101.62, { signed: true })).toBe("+£101.62");
    expect(formatGbp(-1.5, { signed: true })).toBe("-£1.50");
  });
});
