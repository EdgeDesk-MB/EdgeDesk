import { describe, expect, it } from "vitest";
import {
  applyExchangeOddsInputChange,
  formatExchangeOdds,
  getExchangeOddsStep,
  handleExchangeOddsWheel,
  roundExchangeOdds,
  stepExchangeOdds,
} from "./exchange-odds-step";

describe("getExchangeOddsStep", () => {
  it("returns the UK exchange tick for each band", () => {
    expect(getExchangeOddsStep(1.5)).toBe(0.01);
    expect(getExchangeOddsStep(2.5)).toBe(0.02);
    expect(getExchangeOddsStep(3.5)).toBe(0.05);
    expect(getExchangeOddsStep(5)).toBe(0.1);
    expect(getExchangeOddsStep(6)).toBe(0.1);
    expect(getExchangeOddsStep(6.2)).toBe(0.2);
    expect(getExchangeOddsStep(8)).toBe(0.2);
    expect(getExchangeOddsStep(15)).toBe(0.5);
    expect(getExchangeOddsStep(25)).toBe(1);
    expect(getExchangeOddsStep(40)).toBe(2);
    expect(getExchangeOddsStep(75)).toBe(5);
    expect(getExchangeOddsStep(250)).toBe(10);
  });

  it("uses next tier step when stepping up at boundaries", () => {
    expect(getExchangeOddsStep(2, "up")).toBe(0.02);
    expect(getExchangeOddsStep(3, "up")).toBe(0.05);
    expect(getExchangeOddsStep(4, "up")).toBe(0.1);
    expect(getExchangeOddsStep(6, "up")).toBe(0.2);
    expect(getExchangeOddsStep(10, "up")).toBe(0.5);
    expect(getExchangeOddsStep(20, "up")).toBe(1);
  });

  it("uses current tier step when stepping down at boundaries", () => {
    expect(getExchangeOddsStep(2.02, "down")).toBe(0.02);
    expect(getExchangeOddsStep(3.05, "down")).toBe(0.05);
    expect(getExchangeOddsStep(4.1, "down")).toBe(0.1);
    expect(getExchangeOddsStep(6.2, "down")).toBe(0.2);
    expect(getExchangeOddsStep(10.5, "down")).toBe(0.5);
    expect(getExchangeOddsStep(21, "down")).toBe(1);
  });
});

describe("roundExchangeOdds", () => {
  it("snaps to valid increments per tier", () => {
    expect(roundExchangeOdds(2.01)).toBe(2.02);
    expect(roundExchangeOdds(2.996)).toBe(3);
    expect(roundExchangeOdds(3.03)).toBe(3.05);
    expect(roundExchangeOdds(4.14)).toBe(4.1);
    expect(roundExchangeOdds(6.97)).toBe(7);
    expect(roundExchangeOdds(12.3)).toBe(12.5);
    expect(roundExchangeOdds(20.6)).toBe(21);
  });
});

describe("formatExchangeOdds", () => {
  it("uses the decimal places the exchange tick allows", () => {
    expect(formatExchangeOdds(1.51)).toBe("1.51");
    expect(formatExchangeOdds(2.02)).toBe("2.02");
    expect(formatExchangeOdds(4.1)).toBe("4.1");
    expect(formatExchangeOdds(7)).toBe("7.0");
    expect(formatExchangeOdds(21)).toBe("21");
  });

  it("keeps an off-tick typed value until commit", () => {
    expect(formatExchangeOdds(6.97)).toBe("6.97");
  });
});

describe("applyExchangeOddsInputChange", () => {
  it("keeps a typed precise price", () => {
    let value = Number.NaN;
    applyExchangeOddsInputChange(value, 6.97, (v) => {
      value = v;
    });
    expect(value).toBe(6.97);
  });

  it("maps a native spinner step onto the ladder", () => {
    let value = 6.97;
    applyExchangeOddsInputChange(6.97, 7.17, (v) => {
      value = v;
    });
    expect(value).toBe(7);
  });
});

describe("stepExchangeOdds", () => {
  it("steps by 0.01 up to 2.0, then 0.02", () => {
    expect(stepExchangeOdds(1.99, "up")).toBe(2);
    expect(stepExchangeOdds(2, "up")).toBe(2.02);
    expect(stepExchangeOdds(2, "down")).toBe(1.99);
  });

  it("crosses 3.0 boundary with 0.05 steps", () => {
    expect(stepExchangeOdds(2.98, "up")).toBe(3);
    expect(stepExchangeOdds(3, "up")).toBe(3.05);
    expect(stepExchangeOdds(3, "down")).toBe(2.98);
    expect(stepExchangeOdds(3.05, "down")).toBe(3);
  });

  it("crosses 4.0 and 6.0 with the widening ticks", () => {
    expect(stepExchangeOdds(3.95, "up")).toBe(4);
    expect(stepExchangeOdds(4, "up")).toBe(4.1);
    expect(stepExchangeOdds(4.1, "down")).toBe(4);
    expect(stepExchangeOdds(5.9, "up")).toBe(6);
    expect(stepExchangeOdds(6, "up")).toBe(6.2);
    expect(stepExchangeOdds(6.2, "down")).toBe(6);
  });

  it("crosses 10 and 20 boundaries", () => {
    expect(stepExchangeOdds(9.8, "up")).toBe(10);
    expect(stepExchangeOdds(10, "up")).toBe(10.5);
    expect(stepExchangeOdds(20, "up")).toBe(21);
    expect(stepExchangeOdds(21, "down")).toBe(20);
  });

  it("clamps at minimum odds", () => {
    expect(stepExchangeOdds(1.01, "down")).toBe(1.01);
  });

  it("moves an off-tick typed price to the next tick only", () => {
    expect(stepExchangeOdds(6.97, "up")).toBe(7);
    expect(stepExchangeOdds(6.97, "down")).toBe(6.8);
  });
});

describe("handleExchangeOddsWheel", () => {
  it("scroll down lowers odds, scroll up raises", () => {
    let value = 3;
    handleExchangeOddsWheel({ deltaY: 1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(2.98);

    handleExchangeOddsWheel({ deltaY: -1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(3);
  });
});
