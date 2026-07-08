import { describe, expect, it } from "vitest";
import {
  getExchangeOddsStep,
  handleExchangeOddsWheel,
  roundExchangeOdds,
  stepExchangeOdds,
} from "./exchange-odds-step";

describe("getExchangeOddsStep", () => {
  it("returns tier steps without direction", () => {
    expect(getExchangeOddsStep(2.5)).toBe(0.01);
    expect(getExchangeOddsStep(3.5)).toBe(0.05);
    expect(getExchangeOddsStep(6)).toBe(0.1);
    expect(getExchangeOddsStep(15)).toBe(0.5);
    expect(getExchangeOddsStep(25)).toBe(1);
  });

  it("uses next tier step when stepping up at boundaries", () => {
    expect(getExchangeOddsStep(3, "up")).toBe(0.05);
    expect(getExchangeOddsStep(4, "up")).toBe(0.1);
    expect(getExchangeOddsStep(10, "up")).toBe(0.5);
    expect(getExchangeOddsStep(20, "up")).toBe(1);
  });

  it("uses current tier step when stepping down at boundaries", () => {
    expect(getExchangeOddsStep(3.05, "down")).toBe(0.05);
    expect(getExchangeOddsStep(4.1, "down")).toBe(0.1);
    expect(getExchangeOddsStep(10.5, "down")).toBe(0.5);
    expect(getExchangeOddsStep(21, "down")).toBe(1);
  });
});

describe("roundExchangeOdds", () => {
  it("snaps to valid increments per tier", () => {
    expect(roundExchangeOdds(2.996)).toBe(3);
    expect(roundExchangeOdds(3.03)).toBe(3.05);
    expect(roundExchangeOdds(4.14)).toBe(4.1);
    expect(roundExchangeOdds(12.3)).toBe(12.5);
    expect(roundExchangeOdds(20.6)).toBe(21);
  });
});

describe("stepExchangeOdds", () => {
  it("steps by 0.01 up to 3.0", () => {
    expect(stepExchangeOdds(2.99, "up")).toBe(3);
    expect(stepExchangeOdds(3, "down")).toBe(2.99);
  });

  it("crosses 3.0 boundary with 0.05 steps", () => {
    expect(stepExchangeOdds(3, "up")).toBe(3.05);
    expect(stepExchangeOdds(3.05, "down")).toBe(3);
  });

  it("crosses 4.0 boundary with 0.1 steps", () => {
    expect(stepExchangeOdds(3.95, "up")).toBe(4);
    expect(stepExchangeOdds(4, "up")).toBe(4.1);
    expect(stepExchangeOdds(4.1, "down")).toBe(4);
  });

  it("crosses 10 and 20 boundaries", () => {
    expect(stepExchangeOdds(9.9, "up")).toBe(10);
    expect(stepExchangeOdds(10, "up")).toBe(10.5);
    expect(stepExchangeOdds(20, "up")).toBe(21);
    expect(stepExchangeOdds(21, "down")).toBe(20);
  });

  it("clamps at minimum odds", () => {
    expect(stepExchangeOdds(1.01, "down")).toBe(1.01);
  });
});

describe("handleExchangeOddsWheel", () => {
  it("scroll down lowers odds, scroll up raises", () => {
    let value = 3;
    handleExchangeOddsWheel({ deltaY: 1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(2.99);

    handleExchangeOddsWheel({ deltaY: -1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(3);
  });
});
