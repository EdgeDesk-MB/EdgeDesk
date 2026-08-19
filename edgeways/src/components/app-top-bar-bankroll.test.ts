import { describe, expect, it } from "vitest";
import { bankrollAriaLabel, bankrollCompanion } from "./app-top-bar-bankroll";

describe("bankrollCompanion", () => {
  it("keeps Exchange on the right stack when the exchange float is zero", () => {
    expect(bankrollCompanion(0)).toBe("exchange");
  });

  it("swaps Exchange for In-bets when money is tied up", () => {
    expect(bankrollCompanion(12.5)).toBe("in-bets");
  });
});

describe("bankrollAriaLabel", () => {
  it("always names two figures, never Total alone", () => {
    expect(bankrollAriaLabel(0, 0, 250)).toBe("Bankroll: exchange 0.00, total 250.00");
    expect(bankrollAriaLabel(40, 18, 250)).toBe("Bankroll: in-bets 18.00, total 250.00");
  });
});
