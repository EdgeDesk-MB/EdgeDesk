import { describe, expect, it } from "vitest";
import { buildWeeklyDigest, type DigestBet, type DigestLeagueRow } from "./weekly-digest-content";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";

const WEEK_START = Date.UTC(2026, 6, 6); // Mon 6 Jul 2026
const WEEK_END = Date.UTC(2026, 6, 13); // Mon 13 Jul 2026
const IN_WEEK = WEEK_START + 2 * 86_400_000;

let snapId = 0;
function snap(over: Partial<EvSnapshotRow>): EvSnapshotRow {
  return {
    id: ++snapId,
    offerId: snapId,
    version: 1,
    lockedAt: WEEK_START - 86_400_000,
    expectedProfit: 10,
    basis: "estimated",
    inputsJson: null,
    realizedProfit: 10,
    capturePct: 1,
    commissionDrag: null,
    settledAt: IN_WEEK,
    mistakeTag: null,
    ...over,
  };
}

function bet(over: Partial<DigestBet>): DigestBet {
  return {
    betType: "qualifying",
    market: "win",
    status: "lost",
    layStake: 48,
    commission: 0.02,
    notes: null,
    settledAt: IN_WEEK,
    ...over,
  };
}

function league(name: string, droughtNudge: boolean): DigestLeagueRow {
  return { name, droughtNudge };
}

describe("buildWeeklyDigest", () => {
  it("returns null when the week has no settled campaigns (never nag)", () => {
    expect(
      buildWeeklyDigest({
        snapshots: [snap({ settledAt: WEEK_START - 1 })],
        bets: [],
        league: [],
        weekStartMs: WEEK_START,
        weekEndMs: WEEK_END,
      })
    ).toBeNull();
  });

  it("headline: expected 30+23=£53.00, realised 28.50+18.70=£47.20, capture 89%", () => {
    const digest = buildWeeklyDigest({
      snapshots: [
        snap({ expectedProfit: 30, realizedProfit: 28.5 }),
        snap({ expectedProfit: 23, realizedProfit: 18.7, mistakeTag: "laid_late" }),
        snap({ expectedProfit: 99, realizedProfit: 0, settledAt: WEEK_END }), // outside (end-exclusive)
      ],
      bets: [],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    // 47.20 / 53.00 = 0.8905… → 89%
    expect(digest?.title).toBe("Your week: +£47.20 captured (89%)");
    expect(digest?.body).toContain("Expected +£53.00 → realised +£47.20");
  });

  it("capture omitted when expected ≈ 0 (div-by-zero guard)", () => {
    const digest = buildWeeklyDigest({
      snapshots: [snap({ expectedProfit: 0, realizedProfit: 5 })],
      bets: [],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.title).toBe("Your week: +£5.00");
  });

  it("commission drag from window bets only: 48 × 0.02 = £0.96", () => {
    const digest = buildWeeklyDigest({
      snapshots: [snap({})],
      bets: [
        bet({}),
        bet({ settledAt: WEEK_START - 1 }), // outside window, excluded
        bet({ status: "open", settledAt: null }), // open, excluded
      ],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.body).toContain("commission £0.96");
  });

  it("no commission line when drag is zero", () => {
    const digest = buildWeeklyDigest({
      snapshots: [snap({})],
      bets: [bet({ commission: 0 })],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.body).not.toContain("commission");
  });

  it("biggest leak by £ lost within the window: laid_late loses 23−18.70=£4.30", () => {
    const digest = buildWeeklyDigest({
      snapshots: [
        snap({ expectedProfit: 23, realizedProfit: 18.7, mistakeTag: "laid_late" }),
        snap({ expectedProfit: 10, realizedProfit: 9, mistakeTag: "odds_moved" }),
      ],
      bets: [],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.body).toContain("Biggest leak: Laid late (-£4.30)");
  });

  it("drought copy caps at two names plus a count", () => {
    const digest = buildWeeklyDigest({
      snapshots: [snap({})],
      bets: [],
      league: [
        league("Bet365", true),
        league("Coral", true),
        league("Hills", true),
        league("Betfair", false),
      ],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.body).toContain("No offers lately: Bet365, Coral, +1 more");
  });

  it("negative week reads honestly", () => {
    const digest = buildWeeklyDigest({
      snapshots: [snap({ expectedProfit: 12, realizedProfit: -3.4 })],
      bets: [],
      league: [],
      weekStartMs: WEEK_START,
      weekEndMs: WEEK_END,
    });
    expect(digest?.title).toBe("Your week: -£3.40 captured (-28%)");
    expect(digest?.body).toContain("Expected +£12.00 → realised -£3.40");
  });
});
