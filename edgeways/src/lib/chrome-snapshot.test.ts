import { describe, expect, it } from "vitest";
import {
  CHROME_SNAPSHOT_VERSION,
  parseChromeSnapshot,
  type ChromeSnapshot,
} from "./chrome-snapshot";
import { DEFAULT_SETTINGS } from "./services/settings-shared";

const sample: ChromeSnapshot = {
  v: CHROME_SNAPSHOT_VERSION,
  settledProfit: 12.5,
  provisionalProfit: 1,
  balances: {
    total: 100,
    bookies: 40,
    exchanges: 30,
    banks: 20,
    pendingBankCredits: 0,
    inBets: 10,
    bankroll: 90,
    accounts: [],
  },
  demoMode: false,
  alertsUnread: 2,
  boostsOpen: 0,
  casinoNeedsAction: 0,
  accaLayDueCount: 0,
  betBuilderLayDueCount: 0,
  settings: DEFAULT_SETTINGS,
};

describe("parseChromeSnapshot", () => {
  it("reads a current snapshot", () => {
    expect(parseChromeSnapshot(JSON.stringify(sample))).toEqual(sample);
  });

  it("rejects a missing or foreign payload", () => {
    expect(parseChromeSnapshot(null)).toBeNull();
    expect(parseChromeSnapshot("{")).toBeNull();
    expect(parseChromeSnapshot(JSON.stringify({ ...sample, v: 0 }))).toBeNull();
    expect(
      parseChromeSnapshot(JSON.stringify({ ...sample, balances: undefined }))
    ).toBeNull();
  });
});
