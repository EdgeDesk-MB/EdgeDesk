import { describe, expect, it } from "vitest";
import {
  bookieNamesForOwner,
  listOwners,
  ownerByBookmakerName,
  splitPnlByOwner,
} from "./owners";

const acct = (name: string, owner?: string, type = "bookie") => ({ name, owner, type });

describe("owner attribution (J8)", () => {
  it("owners are an open list, 'me' always first", () => {
    expect(listOwners([acct("Bet365"), acct("Sky Bet", "Claire"), acct("Tote", "Alex")]))
      .toEqual(["me", "Alex", "Claire"]);
    expect(listOwners([])).toEqual(["me"]);
  });

  it("identical wallet names across owners are AMBIGUOUS → 'me' + clash", () => {
    const { ownerByName, clashes } = ownerByBookmakerName([
      acct("Bet365"),
      acct("Bet365", "Claire"),
      acct("Sky Bet", "Claire"),
    ]);
    expect(ownerByName.get("bet365")).toBe("me");
    expect(ownerByName.get("sky bet")).toBe("Claire");
    expect(clashes).toEqual(["Bet365"]);
  });

  it("exchanges never enter the bookie owner map", () => {
    const { ownerByName } = ownerByBookmakerName([acct("Betdaq", "Claire", "exchange")]);
    expect(ownerByName.size).toBe(0);
  });
});

describe("splitPnlByOwner", () => {
  const accounts = [acct("Bet365"), acct("Sky Bet · C", "Claire")];
  const bet = (bookmaker: string | null, profit: number | null, over: Record<string, unknown> = {}) => ({
    bookmaker,
    actualProfit: profit,
    status: "won",
    settledAt: 1,
    ...over,
  });

  it("splits settled P&L and ALWAYS reconciles to the combined total", () => {
    const bets = [
      bet("Bet365", 10),
      bet("Sky Bet · C", -3),
      bet("Sky Bet · C", 5),
      bet("Unknown Bookie", 2), // no account → 'me'
      bet(null, 1),             // no bookmaker → 'me'
      bet("Bet365", null, { status: "open", settledAt: null }), // open excluded
    ];
    const rows = splitPnlByOwner(bets, accounts);
    expect(rows).toEqual([
      { owner: "me", settledProfit: 13, settledBets: 3 },
      { owner: "Claire", settledProfit: 2, settledBets: 2 },
    ]);
    const combined = rows.reduce((a, r) => a + r.settledProfit, 0);
    expect(combined).toBeCloseTo(10 - 3 + 5 + 2 + 1, 10);
  });

  it("bookieNamesForOwner powers name-based filters", () => {
    expect([...bookieNamesForOwner(accounts, "Claire")]).toEqual(["sky bet · c"]);
    expect([...bookieNamesForOwner(accounts, "me")]).toEqual(["bet365"]);
  });
});
