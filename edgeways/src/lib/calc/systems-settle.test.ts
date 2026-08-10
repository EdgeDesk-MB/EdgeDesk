import { describe, expect, it } from "vitest";
import { previewSystemStructure, settleSystemReturns } from "./systems-settle";

describe("systems-settle", () => {
  const legs3 = [
    { label: "A", oddsDecimal: 2 },
    { label: "B", oddsDecimal: 2 },
    { label: "C", oddsDecimal: 2 },
  ];

  it("patent has 7 lines", () => {
    const p = previewSystemStructure("patent", 1, legs3);
    expect(p?.betCount).toBe(7);
    expect(p?.totalStake).toBe(7);
  });

  it("trixie needs 2 winners for a return", () => {
    const oneWin = settleSystemReturns("trixie", 1, [
      { ...legs3[0]!, result: "won" },
      { ...legs3[1]!, result: "lost" },
      { ...legs3[2]!, result: "lost" },
    ]);
    expect(oneWin?.returns).toBe(0);
    expect(oneWin?.profit).toBe(-4);

    const twoWin = settleSystemReturns("trixie", 1, [
      { ...legs3[0]!, result: "won" },
      { ...legs3[1]!, result: "won" },
      { ...legs3[2]!, result: "lost" },
    ]);
    // One double at 2×2 = 4
    expect(twoWin?.returns).toBe(4);
    expect(twoWin?.profit).toBe(0);
  });

  it("lucky 15 pays singles when one wins", () => {
    const legs = [
      { label: "A", oddsDecimal: 3, result: "won" as const },
      { label: "B", oddsDecimal: 2, result: "lost" as const },
      { label: "C", oddsDecimal: 2, result: "lost" as const },
      { label: "D", oddsDecimal: 2, result: "lost" as const },
    ];
    const r = settleSystemReturns("lucky_15", 1, legs);
    expect(r?.lines).toBe(15);
    expect(r?.returns).toBe(3);
    expect(r?.profit).toBe(3 - 15);
  });

  it("void leg reduces lines at odds 1.0 (Trixie: combos with C become smaller)", () => {
    // Trixie lines AB, AC, BC, ABC. C void, A+B win @2. Bookmaker reduction:
    // AB pays 4; AC → single A = 2; BC → single B = 2; ABC → double AB = 4 → 12.
    const r = settleSystemReturns("trixie", 1, [
      { label: "A", oddsDecimal: 2, result: "won" },
      { label: "B", oddsDecimal: 2, result: "won" },
      { label: "C", oddsDecimal: 5, result: "void" },
    ]);
    expect(r?.returns).toBe(12);
    expect(r?.profit).toBe(8);
    expect(r?.winPayingLines).toBe(4);
    expect(r?.refundedLines).toBe(0);
  });

  it("canadian has 26 lines", () => {
    const legs = Array.from({ length: 5 }, (_, i) => ({
      label: `L${i + 1}`,
      oddsDecimal: 2,
    }));
    expect(previewSystemStructure("canadian", 1, legs)?.betCount).toBe(26);
  });

  it("heinz / super_heinz / goliath line counts", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      label: `L${i + 1}`,
      oddsDecimal: 2,
    }));
    const seven = Array.from({ length: 7 }, (_, i) => ({
      label: `L${i + 1}`,
      oddsDecimal: 2,
    }));
    const eight = Array.from({ length: 8 }, (_, i) => ({
      label: `L${i + 1}`,
      oddsDecimal: 2,
    }));
    expect(previewSystemStructure("heinz", 1, six)?.betCount).toBe(57);
    expect(previewSystemStructure("super_heinz", 1, seven)?.betCount).toBe(120);
    expect(previewSystemStructure("goliath", 0.1, eight)?.betCount).toBe(247);
  });

  it("yankee with one void reduces lines (D void → singles/doubles/treble)", () => {
    // £1 Yankee, A/B/C win @2, D void. Bookmaker pays:
    // doubles AB,AC,BC = 4 each; AD,BD,CD → singles = 2 each;
    // trebles ABC = 8; ABD,ACD,BCD → doubles = 4 each; fourfold ABCD → treble = 8.
    // Total 12 + 6 + 8 + 12 + 8 = 46; stake 11; profit 35.
    const r = settleSystemReturns("yankee", 1, [
      { label: "A", oddsDecimal: 2, result: "won" },
      { label: "B", oddsDecimal: 2, result: "won" },
      { label: "C", oddsDecimal: 2, result: "won" },
      { label: "D", oddsDecimal: 5, result: "void" },
    ]);
    expect(r?.lines).toBe(11);
    expect(r?.returns).toBe(46);
    expect(r?.profit).toBe(35);
    expect(r?.winPayingLines).toBe(11);
    expect(r?.refundedLines).toBe(0);
  });

  it("all legs void refunds every line in full", () => {
    // £1 Yankee, everything void: 11 lines × £1 refund = 11 back, profit 0.
    const r = settleSystemReturns("yankee", 1, [
      { label: "A", oddsDecimal: 2, result: "void" },
      { label: "B", oddsDecimal: 2, result: "void" },
      { label: "C", oddsDecimal: 2, result: "void" },
      { label: "D", oddsDecimal: 2, result: "void" },
    ]);
    expect(r?.returns).toBe(11);
    expect(r?.profit).toBe(0);
    expect(r?.winPayingLines).toBe(0);
    expect(r?.refundedLines).toBe(11);
  });

  it("each-way + void: void leg reduces both win and place parts", () => {
    // Patent EW, C void, A+B win @2 (place 1/5 → 1.2).
    // Win: singles A=2, B=2, C refunds 1; doubles AB=4, AC→2, BC→2; treble ABC→4 → 17.
    // Place: singles 1.2+1.2, C refunds 1; doubles 1.44, 1.2, 1.2; treble 1.44 → 8.68.
    const r = settleSystemReturns(
      "patent",
      1,
      [
        { label: "A", oddsDecimal: 2, result: "won" },
        { label: "B", oddsDecimal: 2, result: "won" },
        { label: "C", oddsDecimal: 3, result: "void" },
      ],
      { eachWay: true, placeFraction: 0.2 }
    );
    expect(r?.totalStake).toBe(14);
    expect(r?.winReturns).toBe(17);
    expect(r?.placeReturns).toBe(8.68);
    expect(r?.returns).toBe(25.68);
    expect(r?.winPayingLines).toBe(6);
    expect(r?.placePayingLines).toBe(6);
    expect(r?.refundedLines).toBe(1);
  });

  it("each-way lucky 15: one winner pays win single + place single (1/5)", () => {
    // £1 unit EW Lucky 15 = £30 total. A @ 5.00 wins; B,C,D unplaced.
    // Win part: single A = £5. Place odds A = 1+(5-1)*0.2 = 1.8 → place single £1.80.
    const r = settleSystemReturns(
      "lucky_15",
      1,
      [
        { label: "A", oddsDecimal: 5, result: "won" },
        { label: "B", oddsDecimal: 4, result: "lost" },
        { label: "C", oddsDecimal: 3, result: "lost" },
        { label: "D", oddsDecimal: 2, result: "lost" },
      ],
      { eachWay: true, placeFraction: 0.2 }
    );
    expect(r?.lines).toBe(15);
    expect(r?.totalStake).toBe(30);
    expect(r?.winReturns).toBe(5);
    expect(r?.placeReturns).toBe(1.8);
    expect(r?.returns).toBe(6.8);
    expect(r?.profit).toBe(6.8 - 30);
  });

  it("each-way: placed (not win) pays place part only", () => {
    // A placed @ 5.00 (1/5 → 1.8); others lost. Win part £0; place single £1.80.
    const r = settleSystemReturns(
      "lucky_15",
      1,
      [
        { label: "A", oddsDecimal: 5, result: "placed" },
        { label: "B", oddsDecimal: 4, result: "lost" },
        { label: "C", oddsDecimal: 3, result: "lost" },
        { label: "D", oddsDecimal: 2, result: "lost" },
      ],
      { eachWay: true, placeFraction: 0.2 }
    );
    expect(r?.winReturns).toBe(0);
    expect(r?.placeReturns).toBe(1.8);
    expect(r?.returns).toBe(1.8);
    expect(r?.profit).toBe(1.8 - 30);
  });

  it("each-way: two place finishers pay place doubles", () => {
    // A won @5, B placed @4 (place odds 1.8 and 1.6); C,D lost.
    // Win: A single = 5
    // Place: A=1.8, B=1.6, AB=1.8*1.6=2.88 → 6.28
    const r = settleSystemReturns(
      "lucky_15",
      1,
      [
        { label: "A", oddsDecimal: 5, result: "won" },
        { label: "B", oddsDecimal: 4, result: "placed" },
        { label: "C", oddsDecimal: 3, result: "lost" },
        { label: "D", oddsDecimal: 2, result: "lost" },
      ],
      { eachWay: true, placeFraction: 0.2 }
    );
    expect(r?.winReturns).toBe(5);
    expect(r?.placeReturns).toBe(6.28);
    expect(r?.returns).toBe(11.28);
  });
});
