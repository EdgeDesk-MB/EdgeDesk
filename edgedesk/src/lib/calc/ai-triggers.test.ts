import { describe, expect, it } from "vitest";
import {
  describeAiEffect,
  evaluateFreeBetAward,
  inferAiEffectsFromText,
  offerTriggerDetectedInLabel,
  offerTriggerFromLabel,
  previewAiTriggersFromInput,
} from "./ai-triggers";
import type { RaceResult } from "@/lib/racing";

describe("inferAiEffectsFromText", () => {
  it("Bet £50 get £50 → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50");
    expect(effects).toHaveLength(1);
    expect(effects[0].amount).toBe(50);
    expect(effects[0].positions).toEqual([]);
  });

  it("Bet £50 get £50FB → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50FB");
    expect(effects[0].positions).toEqual([]);
    expect(effects[0].amount).toBe(50);
  });

  it("Bet £50 get £50 FB if 2nd, 3rd, 4th → place free bet", () => {
    const effects = inferAiEffectsFromText("Bet £50 get £50 FB if 2nd, 3rd, 4th");
    expect(effects[0].amount).toBe(50);
    expect(effects[0].positions).toEqual([2, 3, 4]);
  });

  it("£50FB 2nd, 3rd, 4th → place free bet", () => {
    const effects = inferAiEffectsFromText("£50FB 2nd, 3rd, 4th");
    expect(effects[0].positions).toEqual([2, 3, 4]);
  });

  it("£50FB alone → unconditional free bet", () => {
    const effects = inferAiEffectsFromText("£50FB");
    expect(effects[0].positions).toEqual([]);
  });

  // Labels use · as Course · Horse · Offer. Splitting on · used to drop the
  // place clause and store an unconditional free bet (wrong £50 credit on wins).
  it("Bet £50 get £50 free bet (2nd, 3rd, 4th) after course · horse → place free bet", () => {
    const effects = inferAiEffectsFromText(
      "Musselburgh · Sophiesticate · Bet £50 get £50 free bet (2nd, 3rd, 4th)"
    );
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      kind: "free_bet_award",
      amount: 50,
      positions: [2, 3, 4],
    });
  });

  it("keeps place positions when runners noise follows a · separator", () => {
    const effects = inferAiEffectsFromText(
      "Bet £50 get £50 FB if 2nd, 3rd, 4th · 8+ runners · expires Sunday"
    );
    expect(effects[0].positions).toEqual([2, 3, 4]);
  });

  it("does not treat an ordinal horse name as a place condition", () => {
    const effects = inferAiEffectsFromText(
      "Ascot · 2nd Thought · Bet £50 get £50 free bet"
    );
    expect(effects).toHaveLength(1);
    expect(effects[0].positions).toEqual([]);
  });

  it("Bet £10 get £10 FB if 2nd to SP favourite → place + SP-fav constraint", () => {
    const effects = inferAiEffectsFromText(
      "Bet £10 get £10 FB if 2nd to SP favourite"
    );
    expect(effects[0]).toMatchObject({
      kind: "free_bet_award",
      amount: 10,
      positions: [2],
      winnerMustBeSpFavourite: true,
    });
    expect(describeAiEffect(effects[0]!)).toContain("2nd to the SP favourite");
  });
});

describe("evaluateFreeBetAward SP favourite", () => {
  const race = (runners: RaceResult["runners"], winner = runners[0]!.horse): RaceResult => ({
    kind: "horse_racing",
    winner,
    runners,
    fieldSize: runners.length,
  });

  it("awards when selection is 2nd and winner was SP favourite", () => {
    const result = evaluateFreeBetAward(
      { kind: "free_bet_award", amount: 10, positions: [2], winnerMustBeSpFavourite: true },
      "Bravo",
      race([
        { horse: "Alpha", position: 1, spDecimal: 2.5 },
        { horse: "Bravo", position: 2, spDecimal: 8 },
      ])
    );
    expect(result.met).toBe(true);
    expect(result.reason).toMatch(/SP favourite/i);
  });

  it("does not award when winner was not the SP favourite", () => {
    const result = evaluateFreeBetAward(
      { kind: "free_bet_award", amount: 10, positions: [2], winnerMustBeSpFavourite: true },
      "Bravo",
      race([
        { horse: "Alpha", position: 1, spDecimal: 8 },
        { horse: "Bravo", position: 2, spDecimal: 2.5 },
      ])
    );
    expect(result.met).toBe(false);
    expect(result.reason).toMatch(/not the SP favourite/i);
  });

  it("does not invent SP favourite when the result has no SP data", () => {
    const result = evaluateFreeBetAward(
      { kind: "free_bet_award", amount: 10, positions: [2], winnerMustBeSpFavourite: true },
      "Bravo",
      race([
        { horse: "Alpha", position: 1 },
        { horse: "Bravo", position: 2 },
      ])
    );
    expect(result.met).toBe(false);
    expect(result.reason).toMatch(/not recorded/i);
  });

  it("awards when winner was manually marked SP favourite", () => {
    const result = evaluateFreeBetAward(
      { kind: "free_bet_award", amount: 10, positions: [2], winnerMustBeSpFavourite: true },
      "Bravo",
      race([
        { horse: "Alpha", position: 1, isSpFavourite: true },
        { horse: "Bravo", position: 2 },
      ])
    );
    expect(result.met).toBe(true);
  });
});

describe("offerTriggerFromLabel", () => {
  it("detects bet-get-free patterns in labels", () => {
    expect(offerTriggerDetectedInLabel("Bet £50 get £50 free bet if 2nd")).toBe(true);
    expect(offerTriggerFromLabel("Bet £50 get £50 free bet if 2nd")).toBe(
      "Bet £50 get £50 free bet if 2nd"
    );
  });

  it("ignores plain bet labels", () => {
    expect(offerTriggerDetectedInLabel("Newmarket · 3:00 Handicap")).toBe(false);
    expect(offerTriggerFromLabel("Newmarket · 3:00 Handicap")).toBeNull();
  });
});
describe("previewAiTriggersFromInput", () => {
  it("does not parse from label leakage", () => {
    const preview = previewAiTriggersFromInput({ triggerText: "Bet £50 get £50" });
    expect(preview.recognised).toBe(true);
    expect(preview.lines[0]).toContain("when this bet settles");
  });
});
