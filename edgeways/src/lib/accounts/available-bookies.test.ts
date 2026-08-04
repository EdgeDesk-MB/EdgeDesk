import { describe, expect, it } from "vitest";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
  visibleBookieNames,
} from "./available-bookies";

describe("availableBookieNames", () => {
  it("only includes active available bookies", () => {
    const set = availableBookieNames([
      { name: "Bet365", type: "bookie", isActive: 1, accessStatus: "available" },
      { name: "Skybet", type: "bookie", isActive: 1, accessStatus: "gubbed" },
      { name: "Closed Co", type: "bookie", isActive: 1, accessStatus: "closed" },
      { name: "Old", type: "bookie", isActive: 0, accessStatus: "available" },
      { name: "Betfair", type: "exchange", isActive: 1, accessStatus: "available" },
    ]);
    expect([...set]).toEqual(["bet365"]);
  });
});

describe("visibleBookieNames", () => {
  it("keeps gubbed bookies visible, drops only closed and inactive (B9)", () => {
    const set = visibleBookieNames([
      { name: "Bet365", type: "bookie", isActive: 1, accessStatus: "available" },
      { name: "Skybet", type: "bookie", isActive: 1, accessStatus: "gubbed" },
      { name: "Closed Co", type: "bookie", isActive: 1, accessStatus: "closed" },
      { name: "Old", type: "bookie", isActive: 0, accessStatus: "available" },
      { name: "Betfair", type: "exchange", isActive: 1, accessStatus: "available" },
    ]);
    expect([...set].sort()).toEqual(["bet365", "skybet"]);
  });
});

describe("offerMatchesAvailableBookies", () => {
  const available = new Set(["bet365", "paddy power"]);

  it("keeps untagged offers", () => {
    expect(offerMatchesAvailableBookies(null, available)).toBe(true);
  });

  it("keeps available bookies", () => {
    expect(offerMatchesAvailableBookies("Bet365", available)).toBe(true);
  });

  it("drops gubbed-only bookies", () => {
    expect(offerMatchesAvailableBookies("Skybet", available)).toBe(false);
  });

  it("shows all when no wallets configured", () => {
    expect(offerMatchesAvailableBookies("Skybet", new Set())).toBe(true);
  });
});
