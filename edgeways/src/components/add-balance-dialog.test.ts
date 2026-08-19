import { describe, expect, it } from "vitest";
import { balanceAmountInputValue } from "./add-balance-dialog";

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
