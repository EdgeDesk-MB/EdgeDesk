import { describe, expect, it } from "vitest";
import {
  commitLayStake,
  formatLayStake,
  handleLayStakeWheel,
  roundLayStake,
  stepLayStake,
} from "./exchange-stake-step";

describe("formatLayStake", () => {
  it("always shows two decimal places, including whole pounds", () => {
    expect(formatLayStake(32)).toBe("32.00");
    expect(formatLayStake(31.5)).toBe("31.50");
    expect(formatLayStake(31.56)).toBe("31.56");
  });

  it("is empty for a pending value", () => {
    expect(formatLayStake(Number.NaN)).toBe("");
  });
});

describe("roundLayStake", () => {
  it("snaps to the exchange penny increment", () => {
    expect(roundLayStake(31.564)).toBe(31.56);
    expect(roundLayStake(31.565)).toBe(31.57);
    expect(roundLayStake(0.004)).toBe(0);
  });
});

describe("commitLayStake", () => {
  it("leaves a cleared field alone", () => {
    expect(Number.isNaN(commitLayStake(Number.NaN))).toBe(true);
  });

  it("keeps a deliberate £0", () => {
    expect(commitLayStake(0)).toBe(0);
  });
});

describe("stepLayStake", () => {
  it("steps by one penny on the exchange grid", () => {
    expect(stepLayStake(31.56, "up")).toBe(31.57);
    expect(stepLayStake(31.56, "down")).toBe(31.55);
  });

  it("does not go below £0", () => {
    expect(stepLayStake(0, "down")).toBe(0);
    expect(stepLayStake(0.01, "down")).toBe(0);
  });

  it("treats an empty field as £0", () => {
    expect(stepLayStake(Number.NaN, "up")).toBe(0.01);
  });
});

describe("handleLayStakeWheel", () => {
  it("scroll down lowers stake, scroll up raises", () => {
    let value = 10;
    handleLayStakeWheel({ deltaY: 1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(9.99);

    handleLayStakeWheel({ deltaY: -1, preventDefault: () => {} }, value, (v) => {
      value = v;
    });
    expect(value).toBe(10);
  });
});
