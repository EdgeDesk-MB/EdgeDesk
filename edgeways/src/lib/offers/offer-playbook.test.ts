import { describe, expect, it } from "vitest";
import {
  applyDepositEvidenceToPlaybook,
  currentPlaybookStep,
  deriveOfferPlaybook,
  emptyPlaybookFacts,
  findDepositEvidence,
  hydrateRefundIfPlaybook,
  markPlaybookStepDone,
  mergePlaybookProgress,
  playbookProgress,
  rulesAfterPlaybookStep,
  syncClearWageringFromBookieWr,
  syncPlaybookFromOfferProfit,
  withPlaybookOnRules,
} from "@/lib/offers/offer-playbook";
import type { OfferProfitBreakdown } from "@/lib/services/offers.types";

function profit(partial: Partial<OfferProfitBreakdown>): OfferProfitBreakdown {
  return {
    qualifyingProfit: 0,
    qualifyingSettledCount: 0,
    qualifyingOpenCount: 0,
    freeBetAwarded: false,
    freeBetAwardAmount: null,
    freeBetAwardReason: null,
    freeBetStage: "none",
    freeBetProfit: 0,
    freeBetOpenCount: 0,
    freeBetSettledCount: 0,
    openExpectedProfit: 0,
    totalProfit: 0,
    ...partial,
  };
}

describe("deriveOfferPlaybook", () => {
  it("starts with deposit when promo code + min deposit present", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
      minOdds: 1.5,
      bookmaker: "Dynobet",
      rewardEventLabel: "PSG vs Aston Villa",
      winningsWageringX: 1,
      paymentExclusions: ["Skrill", "Neteller"],
    });
    expect(pb.steps[0]?.kind).toBe("deposit");
    expect(pb.steps[0]?.title).toMatch(/UEFA/);
    expect(pb.steps[0]?.title).toMatch(/30/);
    expect(pb.steps.some((s) => s.kind === "clear_wagering")).toBe(true);
    expect(currentPlaybookStep(pb)?.kind).toBe("deposit");
  });

  it("starts at qualify for classic bet&get without deposit gate", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 10,
      freeBetAmount: 30,
      minOdds: 1.5,
      bookmaker: "Sky Bet",
    });
    expect(pb.steps[0]?.kind).toBe("qualify");
    expect(pb.steps.some((s) => s.kind === "deposit")).toBe(false);
  });

  it("uses Refund-If underlay copy instead of a tight match", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 100,
      freeBetAmount: 100,
      minOdds: 1.5,
      bookmaker: "BetMGM",
      refundIf: true,
    });
    expect(pb.refundIf).toBe(true);
    const qualify = pb.steps.find((s) => s.kind === "qualify");
    expect(qualify?.title).toBe("Place £100 refund-if bet (min odds 1.5)");
    expect(qualify?.detail).toMatch(/Underlay on the exchange/);
    expect(qualify?.detail).not.toMatch(/qualifying loss tiny/);
    const awaitStep = pb.steps.find((s) => s.kind === "await_award");
    expect(awaitStep?.title).toBe("Await the result");
    expect(awaitStep?.detail).toMatch(/underlay already locked/);
  });

  it("puts min odds once on the qualify title, not again in the detail", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 20,
      freeBetAmount: 10,
      minOdds: 1.5,
      bookmaker: "Dynobet",
    });
    const qualify = pb.steps.find((s) => s.kind === "qualify");
    expect(qualify?.title).toBe("Place £20 qualifying bet (min odds 1.5)");
    expect(qualify?.detail).toBe(
      "Match on the exchange to keep qualifying loss tiny."
    );
    expect(qualify?.detail).not.toMatch(/min odds/i);
  });

  it("names the convert step after a locked reward event", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 10,
      freeBetAmount: 10,
      minOdds: 1.5,
      bookmaker: "Dynobet",
      rewardEventLabel: "Hull City vs Manchester United",
      rewardEventDate: "2026-08-22",
    });
    const convert = pb.steps.find((s) => s.kind === "convert");
    expect(convert?.title).toBe(
      "Use £10 free bet on Hull City vs Manchester United (min odds 1.5)"
    );
    expect(convert?.detail).toMatch(/Hull City vs Manchester United/);
    expect(convert?.detail).toMatch(/2026-08-22/);
  });
});

describe("rulesAfterPlaybookStep", () => {
  it("writes the marked step into rules JSON", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
    });
    const rules = JSON.stringify(withPlaybookOnRules({ type: "promo_terms" }, pb));
    const out = rulesAfterPlaybookStep(rules, profit({}), "deposit", 1_700_000_000_000);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const parsed = JSON.parse(out.rules) as {
      playbook: { steps: Array<{ id: string; status: string }> };
    };
    expect(parsed.playbook.steps.find((s) => s.id === "deposit")?.status).toBe("done");
  });

  it("returns no_playbook when rules have no playbook", () => {
    expect(rulesAfterPlaybookStep(null, profit({}), "deposit")).toEqual({
      ok: false,
      error: "no_playbook",
    });
  });
});

describe("mergePlaybookProgress", () => {
  it("preserves done status by step id when regenerating", () => {
    const first = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
    });
    const marked = markPlaybookStepDone(first, "deposit", 1_700_000_000_000);
    const regenerated = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 40,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
    });
    const merged = mergePlaybookProgress(marked, regenerated);
    expect(merged.steps.find((s) => s.id === "deposit")?.status).toBe("done");
    expect(merged.steps.find((s) => s.id === "deposit")?.title).toMatch(/40/);
    expect(currentPlaybookStep(merged)?.kind).toBe("qualify");
  });
});

describe("findDepositEvidence", () => {
  it("matches a transfer into the offer bookie at/after offer start", () => {
    const evidence = findDepositEvidence({
      bookmaker: "Dynobet",
      minDeposit: 30,
      notBeforeMs: 1_000,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie" }],
      transactions: [
        { id: 9, accountId: 2, amount: 30, category: "transfer", createdAt: 2_000 },
      ],
    });
    expect(evidence).toEqual({ id: 9, amount: 30 });
  });

  it("ignores credits before the offer and under the min deposit", () => {
    expect(
      findDepositEvidence({
        bookmaker: "Dynobet",
        minDeposit: 30,
        notBeforeMs: 5_000,
        accounts: [{ id: 2, name: "Dynobet", type: "bookie" }],
        transactions: [
          { id: 1, accountId: 2, amount: 50, category: "transfer", createdAt: 1_000 },
          { id: 2, accountId: 2, amount: 10, category: "transfer", createdAt: 6_000 },
        ],
      })
    ).toBeNull();
  });
});

describe("applyDepositEvidenceToPlaybook", () => {
  it("marks deposit done with transfer evidence", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
    });
    const next = applyDepositEvidenceToPlaybook(pb, { id: 9, amount: 30 }, 99);
    expect(next.steps.find((s) => s.id === "deposit")?.status).toBe("done");
    expect(next.steps.find((s) => s.id === "deposit")?.evidence).toEqual({
      kind: "transfer",
      id: 9,
    });
    expect(currentPlaybookStep(next)?.kind).toBe("qualify");
  });
});

describe("syncClearWageringFromBookieWr", () => {
  function playbookAtClearWagering() {
    let pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
      winningsWageringX: 1,
      bookmaker: "Dynobet",
    });
    for (const id of ["deposit", "qualify", "await_award", "convert"] as const) {
      pb = markPlaybookStepDone(pb, id);
    }
    return pb;
  }

  it("does not auto-complete when WR was always zero", () => {
    const pb = playbookAtClearWagering();
    const next = syncClearWageringFromBookieWr(pb, {
      bookmaker: "Dynobet",
      convertComplete: true,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie", wrRemaining: 0 }],
    });
    expect(next.steps.find((s) => s.id === "clear_wagering")?.status).toBe("pending");
    expect(next.steps.find((s) => s.id === "clear_wagering")?.evidence).toBeUndefined();
  });

  it("arms wr_watch when outstanding WR appears after convert", () => {
    const pb = playbookAtClearWagering();
    const next = syncClearWageringFromBookieWr(pb, {
      bookmaker: "Dynobet",
      convertComplete: true,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie", wrRemaining: 9.5 }],
    });
    const step = next.steps.find((s) => s.id === "clear_wagering");
    expect(step?.status).toBe("pending");
    expect(step?.evidence).toEqual({ kind: "wr_watch", id: 2 });
    expect(step?.detail).toMatch(/9\.50/);
  });

  it("auto-completes only after wr_watch and WR burns to zero", () => {
    const pb = playbookAtClearWagering();
    const armed = syncClearWageringFromBookieWr(pb, {
      bookmaker: "Dynobet",
      convertComplete: true,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie", wrRemaining: 9.5 }],
    });
    const cleared = syncClearWageringFromBookieWr(armed, {
      bookmaker: "Dynobet",
      convertComplete: true,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie", wrRemaining: 0 }],
    }, 123);
    const step = cleared.steps.find((s) => s.id === "clear_wagering");
    expect(step?.status).toBe("done");
    expect(step?.completion).toBe("auto");
    expect(step?.completedAt).toBe(123);
    expect(currentPlaybookStep(cleared)?.kind).toBe("done");
  });

  it("ignores WR until convert is complete", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "UEFA",
      minDeposit: 30,
      depositRequired: true,
      betStake: 20,
      freeBetAmount: 10,
      winningsWageringX: 1,
      bookmaker: "Dynobet",
    });
    const next = syncClearWageringFromBookieWr(pb, {
      bookmaker: "Dynobet",
      convertComplete: false,
      accounts: [{ id: 2, name: "Dynobet", type: "bookie", wrRemaining: 10 }],
    });
    expect(next.steps.find((s) => s.id === "clear_wagering")?.evidence).toBeUndefined();
  });
});

describe("syncPlaybookFromOfferProfit", () => {
  it("auto-advances qualify and await when free bet awarded", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 10,
      freeBetAmount: 10,
    });
    const withDepositDone = markPlaybookStepDone(
      deriveOfferPlaybook({
        ...emptyPlaybookFacts(),
        promoCode: "X",
        minDeposit: 10,
        depositRequired: true,
        betStake: 10,
        freeBetAmount: 10,
      }),
      "deposit"
    );
    const synced = syncPlaybookFromOfferProfit(
      withDepositDone,
      profit({
        qualifyingSettledCount: 1,
        freeBetAwarded: true,
        freeBetStage: "awarded",
        freeBetAwardAmount: 10,
      })
    );
    expect(synced.steps.find((s) => s.id === "qualify")?.status).toBe("done");
    expect(synced.steps.find((s) => s.id === "await_award")?.status).toBe("done");
    expect(currentPlaybookStep(synced)?.kind).toBe("convert");
    expect(playbookProgress(synced).label).toMatch(/Step \d+ of/);
    // classic path without deposit also syncs
    const classic = syncPlaybookFromOfferProfit(
      pb,
      profit({ qualifyingOpenCount: 1, freeBetStage: "awaiting_result" })
    );
    expect(classic.steps.find((s) => s.id === "qualify")?.status).toBe("done");
  });

  it("auto-completes pending deposit and opt-in once a qualifier is logged", () => {
    const withDeposit = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      promoCode: "X",
      minDeposit: 10,
      depositRequired: true,
      betStake: 10,
      freeBetAmount: 10,
    });
    const withOptIn = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      optInRequired: true,
      betStake: 10,
      freeBetAmount: 10,
      bookmaker: "Paddy Power",
    });
    expect(withDeposit.steps.some((s) => s.kind === "deposit")).toBe(true);
    expect(withOptIn.steps.some((s) => s.kind === "opt_in")).toBe(true);

    const depositSynced = syncPlaybookFromOfferProfit(
      withDeposit,
      profit({ qualifyingOpenCount: 1, freeBetStage: "awaiting_result" })
    );
    const optInSynced = syncPlaybookFromOfferProfit(
      withOptIn,
      profit({ qualifyingOpenCount: 1, freeBetStage: "awaiting_result" })
    );
    expect(depositSynced.steps.find((s) => s.kind === "deposit")?.status).toBe("done");
    expect(optInSynced.steps.find((s) => s.kind === "opt_in")?.status).toBe("done");
    expect(optInSynced.steps.find((s) => s.kind === "qualify")?.status).toBe("done");
    expect(currentPlaybookStep(optInSynced)?.kind).toBe("await_award");
  });

  it("skips convert when a Refund-If qualifier wins (no free bet)", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 100,
      freeBetAmount: 100,
      refundIf: true,
    });
    const synced = syncPlaybookFromOfferProfit(
      pb,
      profit({
        qualifyingSettledCount: 1,
        freeBetStage: "not_awarded",
      })
    );
    expect(synced.steps.find((s) => s.id === "qualify")?.status).toBe("done");
    expect(synced.steps.find((s) => s.id === "await_award")?.status).toBe("skipped");
    expect(synced.steps.find((s) => s.id === "convert")?.status).toBe("skipped");
    expect(synced.steps.find((s) => s.id === "done")?.status).toBe("done");
  });
});

describe("hydrateRefundIfPlaybook", () => {
  it("rewrites stored bet&get copy when the title is money-back-if-loses", () => {
    const pb = deriveOfferPlaybook({
      ...emptyPlaybookFacts(),
      betStake: 100,
      freeBetAmount: 100,
      minOdds: 1.5,
    });
    const hydrated = hydrateRefundIfPlaybook(pb, {
      title: "Money back if bet loses",
    });
    expect(hydrated.refundIf).toBe(true);
    expect(hydrated.steps.find((s) => s.kind === "qualify")?.detail).toMatch(/Underlay/);
    expect(hydrated.steps.find((s) => s.kind === "qualify")?.title).toBe(
      "Place £100 refund-if bet (min odds 1.5)"
    );
  });
});
