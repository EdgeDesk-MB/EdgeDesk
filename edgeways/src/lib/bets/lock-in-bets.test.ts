import { describe, expect, it } from "vitest";
import { isLockInLoggedBet } from "./lock-in-bets";

describe("isLockInLoggedBet", () => {
  it("detects lock-in lay and back labels", () => {
    expect(isLockInLoggedBet({ label: "Lock-in lay · Convert FB · Dynobet" })).toBe(true);
    expect(isLockInLoggedBet({ label: "Lock-in back · Qualifier" })).toBe(true);
  });

  it("detects the close-of note when the label was edited", () => {
    expect(
      isLockInLoggedBet({
        label: "Hull hedge",
        notes: 'Lock-in close of "Convert FB · Dynobet"',
      })
    ).toBe(true);
  });

  it("ignores ordinary lays and free bets", () => {
    expect(isLockInLoggedBet({ label: "Convert FB · Dynobet" })).toBe(false);
    expect(isLockInLoggedBet({ label: "Lay only · Hull", notes: null })).toBe(false);
  });
});
