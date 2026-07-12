import { describe, expect, it } from "vitest";
import { parseBetText, parseOddsToken } from "./parse-bet-text";

// ---------------------------------------------------------------------------
// Synthetic slip corpus (Bet365, SkyBet, Ladbrokes, William Hill formats)
// ---------------------------------------------------------------------------

const BET365_WIN = `
Bet ID: 987654321
Selection: Arsenal Win
Event: Arsenal v Chelsea, Premier League
Date: Saturday, 12 July 2026
Stake: £10.00
Odds: 2.50
Potential Returns: £25.00
`;

const SKYBET_WIN = `
Bet Ref: SKB-999888
Arsenal Win
@ 2.50
Stake £10.00
Returns: £25.00
`;

const LADBROKES_FRACTIONAL = `
Bet Reference: LAD-12345
Stake: £5.00
Odds: 5/2
Selection: Frankel Win
Event: Newmarket, 15:30
Potential Returns: £17.50
`;

const WILLIAM_HILL_DECIMAL_FRACTIONAL = `
Bet ID: WH-777
Stake: £20.00
Odds: 3.50 (5/2)
Selection: Manchester City v Arsenal - Over 2.5 Goals
Potential Returns: £70.00
`;

const FREE_BET_SNR = `
Bet ID: FB123
Selection: Chelsea Win
Event: Chelsea v Spurs
Free Bet: £25.00 SNR
Odds: 3.00
Potential Returns: £75.00
`;

const FREE_BET_SR = `
Your Free Bet (Stake Returned)
Selection: Liverpool Win
Odds: 2.20
Free Bet: £10.00 SR
Potential Returns: £22.00
`;

const EACH_WAY = `
Bet Reference: EW-456
Selection: NOBLE CHAMPION
Event: Cheltenham 14:15
Stake: £5.00 EW (£5.00 each side)
Odds: 10/1 (1/5 odds, 4 places)
Potential Returns: £85.00
`;

const LADBROKES_FREE_BET = `
Reference: LAD-FREE-001
You are using a Free Bet of £10.00
Selection: Norwich Win
Odds: 4.50
`;

const RACING_SLIP_CAPS = `
WINX
15:30 Cheltenham
Stake: £8.00
Odds: 1.50
`;

const GARBAGE_1 = `hello world this is not a bet slip at all`;
const GARBAGE_2 = ``;
const GARBAGE_3 = `1234567890`;

// ---------------------------------------------------------------------------
// parseOddsToken
// ---------------------------------------------------------------------------

describe("parseOddsToken", () => {
  it("parses decimal odds", () => {
    expect(parseOddsToken("3.50")).toBeCloseTo(3.5);
    expect(parseOddsToken("2.00")).toBeCloseTo(2.0);
    expect(parseOddsToken("1.25")).toBeCloseTo(1.25);
  });

  it("parses fractional odds with /", () => {
    expect(parseOddsToken("5/2")).toBeCloseTo(3.5);
    expect(parseOddsToken("10/1")).toBeCloseTo(11.0);
    expect(parseOddsToken("1/2")).toBeCloseTo(1.5);
  });

  it("parses fractional odds with -", () => {
    expect(parseOddsToken("5-2")).toBeCloseTo(3.5);
    expect(parseOddsToken("10-1")).toBeCloseTo(11.0);
  });

  it("parses evens", () => {
    expect(parseOddsToken("evens")).toBe(2);
    expect(parseOddsToken("EVENS")).toBe(2);
    expect(parseOddsToken("even")).toBe(2);
  });

  it("returns null for invalid input", () => {
    expect(parseOddsToken("garbage")).toBeNull();
    expect(parseOddsToken("1")).toBeNull(); // must be > 1
    expect(parseOddsToken("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseBetText — garbage / edge cases
// ---------------------------------------------------------------------------

describe("parseBetText — garbage", () => {
  it("returns null for empty string", () => {
    expect(parseBetText(GARBAGE_2)).toBeNull();
  });

  it("returns null for plain text with no bet data", () => {
    expect(parseBetText(GARBAGE_1)).toBeNull();
  });

  it("returns null for bare numbers", () => {
    expect(parseBetText(GARBAGE_3)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseBetText — Bet365
// ---------------------------------------------------------------------------

describe("parseBetText — Bet365 win", () => {
  const result = parseBetText(BET365_WIN)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("extracts stake", () => {
    expect(result.backStake?.value).toBeCloseTo(10);
    expect(result.backStake?.confident).toBe(true);
  });
  it("extracts decimal odds", () => {
    expect(result.backOdds?.value).toBeCloseTo(2.5);
    expect(result.backOdds?.confident).toBe(true);
  });
  it("extracts selection", () => {
    expect(result.selection?.value).toMatch(/Arsenal Win/i);
  });
  it("is not a free bet", () => {
    expect(result.isFreeBet).toBe(false);
    expect(result.betType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseBetText — Ladbrokes fractional odds
// ---------------------------------------------------------------------------

describe("parseBetText — Ladbrokes fractional", () => {
  const result = parseBetText(LADBROKES_FRACTIONAL)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("converts fractional to decimal", () => {
    expect(result.backOdds?.value).toBeCloseTo(3.5); // 5/2 = 3.5
  });
  it("extracts stake", () => {
    expect(result.backStake?.value).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// parseBetText — William Hill decimal with fractional in parens
// ---------------------------------------------------------------------------

describe("parseBetText — William Hill decimal+fractional", () => {
  const result = parseBetText(WILLIAM_HILL_DECIMAL_FRACTIONAL)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("prefers the decimal odds", () => {
    expect(result.backOdds?.value).toBeCloseTo(3.5);
    expect(result.backOdds?.confident).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseBetText — free bet SNR
// ---------------------------------------------------------------------------

describe("parseBetText — free bet SNR", () => {
  const result = parseBetText(FREE_BET_SNR)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("detects free bet", () => expect(result.isFreeBet).toBe(true));
  it("sets betType to free_snr", () => {
    expect(result.betType?.value).toBe("free_snr");
    expect(result.betType?.confident).toBe(true); // SNR explicit
  });
});

// ---------------------------------------------------------------------------
// parseBetText — free bet SR
// ---------------------------------------------------------------------------

describe("parseBetText — free bet SR", () => {
  const result = parseBetText(FREE_BET_SR)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("detects free bet", () => expect(result.isFreeBet).toBe(true));
  it("sets betType to free_sr", () => {
    expect(result.betType?.value).toBe("free_sr");
  });
});

// ---------------------------------------------------------------------------
// parseBetText — each-way slip
// ---------------------------------------------------------------------------

describe("parseBetText — each-way", () => {
  const result = parseBetText(EACH_WAY)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("detects each-way market hint", () => {
    expect(result.marketHint?.value).toBe("each_way");
  });
  it("extracts per-side stake", () => {
    expect(result.backStake?.value).toBeCloseTo(5);
  });
  it("converts fractional odds", () => {
    expect(result.backOdds?.value).toBeCloseTo(11); // 10/1
  });
});

// ---------------------------------------------------------------------------
// parseBetText — all-caps horse name
// ---------------------------------------------------------------------------

describe("parseBetText — racing ALL CAPS horse", () => {
  const result = parseBetText(RACING_SLIP_CAPS)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("extracts horse name from ALL CAPS line", () => {
    expect(result.selection?.value).toBe("WINX");
  });
});

// ---------------------------------------------------------------------------
// parseBetText — Ladbrokes free bet (general phrasing)
// ---------------------------------------------------------------------------

describe("parseBetText — Ladbrokes free bet general", () => {
  const result = parseBetText(LADBROKES_FREE_BET)!;

  it("returns a result", () => expect(result).not.toBeNull());
  it("detects free bet from general phrasing", () => {
    expect(result.isFreeBet).toBe(true);
  });
});
