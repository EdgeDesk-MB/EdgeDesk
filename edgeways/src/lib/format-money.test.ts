import { describe, expect, it } from "vitest";
import {
  formatEvGbp,
  formatGbp,
  formatMoneyAmount,
  evFractionDigits,
  isNegativeGbp,
  roundMoney,
} from "@/lib/format-money";

describe("format-money", () => {
  it("rounds to pence", () => {
    expect(roundMoney(449.625)).toBe(449.63);
    expect(roundMoney(101.624999)).toBe(101.62);
  });

  it("does not treat display-zero dust as negative", () => {
    expect(isNegativeGbp(-1.4210854715202004e-14)).toBe(false);
    expect(isNegativeGbp(-0.004)).toBe(false);
    expect(isNegativeGbp(0)).toBe(false);
    expect(isNegativeGbp(-0.01)).toBe(true);
    expect(isNegativeGbp(-1)).toBe(true);
  });

  it("formats bare amounts with two decimal places", () => {
    expect(formatMoneyAmount(36.2)).toBe("36.20");
    expect(formatMoneyAmount(20)).toBe("20.00");
  });

  it("formats with two decimal places", () => {
    expect(formatGbp(551.2)).toBe("£551.20");
    expect(formatGbp(28.6)).toBe("£28.60");
  });

  it("formats signed deltas", () => {
    expect(formatGbp(101.62, { signed: true })).toBe("+£101.62");
    expect(formatGbp(-1.5, { signed: true })).toBe("-£1.50");
  });

  it("formats EV amounts with variable decimals", () => {
    expect(formatEvGbp(14)).toBe("£14");
    expect(formatEvGbp(6.7)).toBe("£6.70");
    expect(formatEvGbp(9.5)).toBe("£9.50");
    expect(formatEvGbp(14.5)).toBe("£14.50");
    expect(evFractionDigits(14)).toBe(0);
    expect(evFractionDigits(6.7)).toBe(2);
  });

  it("formats signed EV amounts", () => {
    expect(formatEvGbp(6.7, { signed: true })).toBe("+£6.70");
    expect(formatEvGbp(-9.5, { signed: true })).toBe("-£9.50");
    expect(formatEvGbp(14, { signed: true })).toBe("+£14");
  });
});
