import { describe, expect, it } from "vitest";
import {
  bookmakerHealthMap,
  computeBookmakerStats,
  effectiveBookmakerHealth,
  DROUGHT_NUDGE_DAYS,
  type BookmakerStatsAccount,
  type BookmakerStatsBet,
} from "./bookmaker-stats";

const NOW = new Date(2026, 6, 14, 12, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

function account(over: Partial<BookmakerStatsAccount> & { id: number; name: string }): BookmakerStatsAccount {
  return { type: "bookie", isActive: 1, accessStatus: "available", health: null, ...over };
}

function bet(over: Partial<BookmakerStatsBet>): BookmakerStatsBet {
  return {
    bookmaker: "Bet365",
    betType: "qualifying",
    status: "lost",
    backStake: 50,
    actualProfit: -2,
    settledAt: NOW - 5 * DAY,
    ...over,
  };
}

describe("effectiveBookmakerHealth", () => {
  it("derives gubbed from accessStatus, cooling from the manual flag", () => {
    expect(effectiveBookmakerHealth({ accessStatus: "available", health: null })).toBe("healthy");
    expect(effectiveBookmakerHealth({ accessStatus: "available", health: "cooling" })).toBe("cooling");
    expect(effectiveBookmakerHealth({ accessStatus: "gubbed", health: null })).toBe("gubbed");
    expect(effectiveBookmakerHealth({ accessStatus: "closed", health: "cooling" })).toBe("gubbed");
  });
});

describe("bookmakerHealthMap", () => {
  it("keys by normalised name and skips non-bookie accounts", () => {
    const map = bookmakerHealthMap([
      account({ id: 1, name: " Bet365 ", accessStatus: "gubbed" }),
      account({ id: 2, name: "Smarkets", type: "exchange" }),
    ]);
    expect(map.get("bet365")).toBe("gubbed");
    expect(map.has("smarkets")).toBe(false);
  });
});

describe("computeBookmakerStats", () => {
  it("mug bets stay in profit/staked (real money) and get their own month line (J5)", () => {
    const rows = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [
        bet({}), // edge: −2 on 50
        bet({ purpose: "mug", actualProfit: -5, backStake: 10, settledAt: NOW - 2 * DAY }),
        bet({ purpose: "mug", actualProfit: -4, backStake: 10, settledAt: NOW - 40 * DAY }), // last month
      ],
      offers: [],
      now: NOW,
    });
    const row = rows[0]!;
    expect(row.profit).toBeCloseTo(-11, 10); // ALL real money kept
    expect(row.staked).toBeCloseTo(70, 10);
    expect(row.mugNetMonth).toBeCloseTo(-5, 10); // only this month's camouflage
  });


  it("computes ROI and retention per bookie from settled non-void bets", () => {
    const rows = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [
        // Qualifying loss: -2 on 50 staked
        bet({}),
        // SNR conversion: £38 retained from £50 face
        bet({ betType: "free_snr", status: "won", backStake: 50, actualProfit: 38 }),
        // Open and void bets are excluded from every aggregate
        bet({ status: "open", settledAt: null, actualProfit: null }),
        bet({ status: "void", actualProfit: 0 }),
      ],
      offers: [{ bookmaker: "Bet365", createdAt: NOW - 10 * DAY }],
      now: NOW,
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // profit 36 on 100 staked → ROI 0.36
    expect(row.profit).toBeCloseTo(36, 10);
    expect(row.staked).toBeCloseTo(100, 10);
    expect(row.roi).toBeCloseTo(0.36, 10);
    expect(row.settledBets).toBe(2);
    expect(row.retention).toEqual({ rate: 0.76, sampleSize: 1 });
    expect(row.offerCount).toBe(1);
    expect(row.daysSinceLastOffer).toBe(10);
    expect(row.droughtNudge).toBe(false);
  });

  it("nudges healthy bookies after a >40-day offer drought, never unhealthy ones", () => {
    const staleOffer = { bookmaker: "Bet365", createdAt: NOW - (DROUGHT_NUDGE_DAYS + 3) * DAY };
    const healthy = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [],
      offers: [{ ...staleOffer }],
      now: NOW,
    })[0]!;
    expect(healthy.daysSinceLastOffer).toBe(DROUGHT_NUDGE_DAYS + 3);
    expect(healthy.droughtNudge).toBe(true);

    const cooling = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365", health: "cooling" })],
      bets: [],
      offers: [{ ...staleOffer }],
      now: NOW,
    })[0]!;
    expect(cooling.droughtNudge).toBe(false);

    // No offers at all → no drought basis, no nudge
    const noOffers = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [],
      offers: [],
      now: NOW,
    })[0]!;
    expect(noOffers.daysSinceLastOffer).toBeNull();
    expect(noOffers.droughtNudge).toBe(false);
  });

  it("honours the E1 droughtNudgeDays override", () => {
    const tenDaysAgo = { bookmaker: "Bet365", createdAt: NOW - 10 * DAY };
    const strict = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [],
      offers: [tenDaysAgo],
      now: NOW,
      droughtNudgeDays: 7,
    })[0]!;
    expect(strict.droughtNudge).toBe(true);

    const lax = computeBookmakerStats({
      accounts: [account({ id: 1, name: "Bet365" })],
      bets: [],
      offers: [tenDaysAgo],
      now: NOW,
      droughtNudgeDays: 30,
    })[0]!;
    expect(lax.droughtNudge).toBe(false);
  });

  it("sorts by realised profit and skips inactive accounts", () => {
    const rows = computeBookmakerStats({
      accounts: [
        account({ id: 1, name: "Bet365" }),
        account({ id: 2, name: "Coral" }),
        account({ id: 3, name: "Archived", isActive: 0 }),
      ],
      bets: [
        bet({ bookmaker: "Coral", status: "won", actualProfit: 20 }),
        bet({ bookmaker: "bet365 ", status: "won", actualProfit: 5 }),
      ],
      offers: [],
      now: NOW,
    });
    expect(rows.map((r) => r.name)).toEqual(["Coral", "Bet365"]);
  });
});
