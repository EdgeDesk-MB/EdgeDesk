import { describe, expect, it } from "vitest";
import { parseBookieScreenshot, parseExchangeScreenshot } from "./parse-bet-screenshot";

const BOOKIE_OCR = `
Betslip
Bet placed successfully
SINGLES
4 Kit Gabriel
Win - 18:10 Wolverhampton
Odds
11
Stake
£50.00
Returns
£500.00
Includes £50.00 in Free Bets
Total Stake
£50.00
Total Returns
£500.00
`;

/** Actual Tesseract output from Betfair Sportsbook betslip (11 misread as 1). */
const BETFAIR_TESSERACT_OCR = `
Betslip X
Bet placed successfully
SINGLES
Odds Stake Returns
1 £50.00 £500.00
Includes £50.00 in Free Bets
Total Stake Total Returns
£50.00 £500.00
`;

const EXCHANGE_OCR = `
Lay 4 Kit Gabriel
07-07-2026
18:10 Wolverhampton - Win Market
Reference 116233770083
Bet Result Win
Bet Details
Status Settled
Requested Odds
13
Matched Odds
13
Matched Stake
£30.12
Unmatched Stake
£0.00
Time Bet Placed
07-07-2026 17:27
`;

describe("parseBookieScreenshot", () => {
  it("reads odds from Odds label, not Returns", () => {
    const f = parseBookieScreenshot(BOOKIE_OCR);
    expect(f.backOdds).toBe(11);
    expect(f.backStake).toBe(50);
    expect(f.selection).toMatch(/Kit Gabriel/i);
    expect(f.eventTime).toBe("18:10");
    expect(f.eventName).toMatch(/Wolverhampton/);
  });

  it("ignores £500 as odds when Returns is labelled", () => {
    const f = parseBookieScreenshot(BOOKIE_OCR);
    expect(f.backOdds).not.toBe(500);
  });

  it("reads a Tesseract sparse dump with silk junk on the second runner", () => {
    const f = parseBookieScreenshot(`MULTIPLES

2 Selections

4 Notable Speech

3.50

Win - 15:00 York

V* 7 Dance In The Storm

3.25

Win - 16:10 York
`);
    expect(f.legs).toHaveLength(2);
    expect(f.legs?.[1]?.label).toBe("Dance In The Storm");
    expect(f.legs?.[1]?.eventTime).toBe("16:10");
  });

  it("reads Sportsbook multiples legs with course and off time", () => {
    const f = parseBookieScreenshot(`
MULTIPLES
2 Selections
4 Notable Speech 3.50
Win - 15:00 York
7 Dance In The Storm 3.25
Win - 16:10 York
`);
    expect(f.structure).toBe("accumulator");
    expect(f.legs).toHaveLength(2);
    expect(f.legs?.[0]).toMatchObject({
      label: "Notable Speech",
      odds: 3.5,
      eventTime: "15:00",
      course: "York",
      market: "win",
    });
    expect(f.legs?.[1]?.label).toBe("Dance In The Storm");
  });

  it("detects win market and free bet promo", () => {
    const f = parseBookieScreenshot(BOOKIE_OCR);
    expect(f.marketHint).toBe("win");
    expect(f.isFreeBet).toBe(true);
  });

  it("infers odds 11 from column row when OCR reads 1 instead of 11", () => {
    const f = parseBookieScreenshot(BETFAIR_TESSERACT_OCR);
    expect(f.backOdds).toBe(11);
    expect(f.backStake).toBe(50);
    expect(f.isFreeBet).toBe(true);
  });
});

describe("parseExchangeScreenshot", () => {
  it("reads matched stake and odds from labels", () => {
    const f = parseExchangeScreenshot(EXCHANGE_OCR);
    expect(f.layOdds).toBe(13);
    expect(f.layStake).toBe(30.12);
    expect(f.selection).toMatch(/Kit Gabriel/i);
    expect(f.eventTime).toBe("18:10");
    expect(f.eventDate).toBe("2026-07-07");
  });

  it("detects win market from exchange slip", () => {
    const f = parseExchangeScreenshot(EXCHANGE_OCR);
    expect(f.marketHint).toBe("win");
  });
});
