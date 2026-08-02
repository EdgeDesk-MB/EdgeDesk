import { describe, expect, it } from "vitest";
import { serializeTriggerBundle, type AiEffect } from "@/lib/calc/ai-triggers";
import {
  showEarlyFreeBetAwardButton,
  unconditionalFreeBetEffect,
} from "./early-free-bet-award";

function bet(partial: {
  id?: number;
  status?: string;
  bookmaker?: string | null;
  betType?: string;
  label?: string;
  triggerText?: string | null;
  triggerRule?: string | null;
}) {
  return {
    id: partial.id ?? 1,
    status: partial.status ?? "open",
    bookmaker: partial.bookmaker === undefined ? "Ladbrokes" : partial.bookmaker,
    betType: partial.betType ?? "qualifying",
    label: partial.label ?? "Qualify",
    triggerText: partial.triggerText ?? null,
    triggerRule: partial.triggerRule ?? null,
  };
}

function ruleWithEffect(effect: AiEffect): string {
  return serializeTriggerBundle({
    v: 2,
    betWin: null,
    effects: [effect],
  });
}

describe("unconditionalFreeBetEffect", () => {
  it("reads Bet £10 get £10 from trigger text", () => {
    const effect = unconditionalFreeBetEffect(
      bet({ triggerText: "Bet £10 get £10" })
    );
    expect(effect).toEqual({
      kind: "free_bet_award",
      amount: 10,
      positions: [],
    });
  });

  it("ignores place-conditional rewards", () => {
    expect(
      unconditionalFreeBetEffect(
        bet({ triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th" })
      )
    ).toBeNull();
  });

  it("prefers stored trigger rule over label", () => {
    const effect = unconditionalFreeBetEffect(
      bet({
        label: "Something else",
        triggerRule: ruleWithEffect({
          kind: "free_bet_award",
          amount: 25,
          positions: [],
        }),
      })
    );
    expect(effect?.amount).toBe(25);
  });
});

describe("showEarlyFreeBetAwardButton", () => {
  const placed = { kind: "bet_placed" as const, betId: 1 };

  it("shows for an open unconditional reward bet pending credit", () => {
    expect(
      showEarlyFreeBetAwardButton(placed, bet({ triggerText: "Bet £10 get £10" }), undefined)
    ).toBe(true);
  });

  it("hides once a promo credit exists", () => {
    expect(
      showEarlyFreeBetAwardButton(placed, bet({ triggerText: "Bet £10 get £10" }), {
        amount: 10,
        reason: "Awarded on placement",
      })
    ).toBe(false);
  });

  it("hides for place-conditional offers", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ triggerText: "Bet £50 get £50 FB if 2nd-4th" }),
        undefined
      )
    ).toBe(false);
  });

  it("hides on settlement rows", () => {
    expect(
      showEarlyFreeBetAwardButton(
        { kind: "settlement", betId: 1 },
        bet({ triggerText: "Bet £10 get £10" }),
        undefined
      )
    ).toBe(false);
  });

  it("hides when the bookie is missing", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ bookmaker: "", triggerText: "Bet £10 get £10" }),
        undefined
      )
    ).toBe(false);
  });

  it("hides void bets", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ status: "void", triggerText: "Bet £10 get £10" }),
        undefined
      )
    ).toBe(false);
  });

  it("hides free-bet conversion bets", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ betType: "free_snr", triggerText: "Bet £10 get £10" }),
        undefined
      )
    ).toBe(false);
  });

  it("uses the linked offer title when the bet has no trigger text", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ label: "Qualify · Ladbrokes", triggerText: null }),
        undefined,
        "Bet £10 get £10 free bet"
      )
    ).toBe(true);
  });

  it("still ignores place-conditional offer titles", () => {
    expect(
      showEarlyFreeBetAwardButton(
        placed,
        bet({ label: "Qualify · Ladbrokes", triggerText: null }),
        undefined,
        "Bet £50 get £50 FB if 2nd-4th"
      )
    ).toBe(false);
  });
});
