import { describe, expect, it } from "vitest";
import {
  adjustBalanceFooterModel,
  adjustPnlHelpText,
  balanceAmountInputValue,
  balanceDeltaClass,
  ledgerAmountForRow,
  nextUnusedAccountId,
} from "./add-balance-dialog";

describe("balanceAmountInputValue", () => {
  it("keeps 0 visible when adjusting to a zero balance", () => {
    expect(balanceAmountInputValue(0, "adjustment")).toBe(0);
  });

  it("keeps a non-zero adjust target as the typed amount", () => {
    expect(balanceAmountInputValue(109.6, "adjustment")).toBe(109.6);
  });

  it("leaves top-up and withdraw empty when the amount is 0", () => {
    expect(balanceAmountInputValue(0, "top_up")).toBe("");
    expect(balanceAmountInputValue(0, "withdrawal")).toBe("");
  });

  it("shows a typed top-up amount", () => {
    expect(balanceAmountInputValue(25, "top_up")).toBe(25);
  });
});

describe("ledgerAmountForRow", () => {
  it("uses the typed amount for a top-up", () => {
    expect(ledgerAmountForRow("top_up", 6.28, 10)).toBe(6.28);
  });

  it("signs a withdrawal as money leaving the wallet", () => {
    expect(ledgerAmountForRow("withdrawal", 6.28, 10)).toBe(-6.28);
  });

  it("returns the delta from the current balance when adjusting", () => {
    expect(ledgerAmountForRow("adjustment", 20, 12.5)).toBe(7.5);
  });
});

describe("nextUnusedAccountId", () => {
  it("prefers an account that is not already on a row", () => {
    expect(nextUnusedAccountId([{ id: 1 }, { id: 2 }, { id: 3 }], [1, 3])).toBe(2);
  });

  it("falls back to the first account when every wallet is already used", () => {
    expect(nextUnusedAccountId([{ id: 1 }, { id: 2 }], [1, 2])).toBe(1);
  });
});

describe("balanceDeltaClass", () => {
  it("uses muted type for a zero change instead of profit green", () => {
    expect(balanceDeltaClass(0)).toBe("text-muted-foreground");
  });

  it("uses profit and negative tokens for signed amounts", () => {
    expect(balanceDeltaClass(6.28)).toBe("text-profit");
    expect(balanceDeltaClass(-4)).toBe("text-negative");
  });
});

describe("adjustBalanceFooterModel", () => {
  it("labels a P&L top-up as profit", () => {
    const footer = adjustBalanceFooterModel({
      mode: "top_up",
      affectPnl: true,
      cashDelta: 6.28,
      freeBetAmount: 0,
      newBalance: 6.28,
      breakdown: [{ name: "Paddy Power", amount: 6.28, fundKind: "cash" }],
    });
    expect(footer.headlineLabel).toBe("Profit");
    expect(footer.headlineAmount).toBe(6.28);
    expect(footer.headlineSigned).toBe(true);
    expect(footer.supportingNewBalance).toBe(6.28);
  });

  it("labels a negative P&L correction as loss", () => {
    const footer = adjustBalanceFooterModel({
      mode: "adjustment",
      affectPnl: true,
      cashDelta: -4,
      freeBetAmount: 0,
      newBalance: null,
      breakdown: [{ name: "Betfair", amount: -4, fundKind: "cash" }],
    });
    expect(footer.headlineLabel).toBe("Loss");
    expect(footer.headlineSigned).toBe(true);
  });

  it("totals multiple cash rows as one profit headline", () => {
    const footer = adjustBalanceFooterModel({
      mode: "top_up",
      affectPnl: true,
      cashDelta: 11.28,
      freeBetAmount: 0,
      newBalance: null,
      breakdown: [
        { name: "Paddy Power", amount: 6.28, fundKind: "cash" },
        { name: "Monzo", amount: 5, fundKind: "cash" },
      ],
    });
    expect(footer.headlineLabel).toBe("Profit");
    expect(footer.headlineAmount).toBe(11.28);
  });

  it("keeps a single-account top-up as new balance when P&L is off", () => {
    const footer = adjustBalanceFooterModel({
      mode: "top_up",
      affectPnl: false,
      cashDelta: 6.28,
      freeBetAmount: 0,
      newBalance: 6.28,
      breakdown: [{ name: "Paddy Power", amount: 6.28, fundKind: "cash" }],
    });
    expect(footer.headlineLabel).toBe("New balance");
    expect(footer.headlineSigned).toBe(false);
    expect(footer.supportingDelta).toBe(6.28);
  });

  it("keeps free-bet rows off the P&L per-account split", () => {
    const footer = adjustBalanceFooterModel({
      mode: "top_up",
      affectPnl: true,
      cashDelta: 6.28,
      freeBetAmount: 10,
      newBalance: null,
      breakdown: [
        { name: "Paddy Power", amount: 6.28, fundKind: "cash" },
        { name: "Sky Bet", amount: 10, fundKind: "free_bet" },
      ],
    });
    expect(footer.headlineLabel).toBe("Profit");
    expect(footer.freeBetAmount).toBe(10);
  });

  it("does not label a zero cash delta as P&L", () => {
    const footer = adjustBalanceFooterModel({
      mode: "top_up",
      affectPnl: true,
      cashDelta: 0,
      freeBetAmount: 10,
      newBalance: null,
      breakdown: [{ name: "Sky Bet", amount: 10, fundKind: "free_bet" }],
    });
    expect(footer.headlineLabel).not.toBe("P&L");
    expect(footer.headlineLabel).toBe("Cash");
  });
});

describe("adjustPnlHelpText", () => {
  it("says the switch applies to every cash row when more than one is in play", () => {
    expect(
      adjustPnlHelpText({
        enabled: true,
        mode: "top_up",
        cashRowCount: 2,
        cashDelta: 11.28,
      })
    ).toBe(
      "Applies to all 2 cash rows. Home and History will show +£11.28 as profit."
    );
  });

  it("explains the off state as a wallet move", () => {
    expect(
      adjustPnlHelpText({
        enabled: false,
        mode: "top_up",
        cashRowCount: 2,
        cashDelta: 11.28,
      })
    ).toBe("Wallet move only. Turn on to count every cash row as profit or loss.");
  });
});
