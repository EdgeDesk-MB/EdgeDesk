/**
 * Offer completion playbook (O1) — ordered operational steps for working a
 * campaign. Financial pipeline stays in pipeline.ts; this is the wizard the
 * user is funnelled through (hybrid: auto from ledger + Mark done).
 */

import type { OfferImportantTerms } from "@/lib/offers/offer-terms";
import type { OfferProfitBreakdown } from "@/lib/services/offers.types";

export type OfferPlaybookStepKind =
  | "deposit"
  | "opt_in"
  | "qualify"
  | "await_award"
  | "convert"
  | "clear_wagering"
  | "done";

export type OfferPlaybookStepStatus = "pending" | "done" | "skipped";

export type OfferPlaybookEvidence = {
  /** wr_watch = saw outstanding bookie WR after convert; clear when it hits £0 */
  kind: "bet" | "transfer" | "manual" | "wr_watch";
  id?: number;
};

export interface OfferPlaybookStep {
  id: string;
  kind: OfferPlaybookStepKind;
  title: string;
  detail: string;
  sortOrder: number;
  status: OfferPlaybookStepStatus;
  completion: "auto" | "manual" | null;
  completedAt: number | null;
  evidence?: OfferPlaybookEvidence;
}

export interface OfferPlaybook {
  version: 1;
  steps: OfferPlaybookStep[];
}

export interface OfferPlaybookFacts {
  promoCode: string | null;
  minDeposit: number | null;
  depositRequired: boolean;
  rewardEventLabel: string | null;
  rewardEventDate: string | null;
  winningsWageringX: number | null;
  maxConversion: number | null;
  paymentExclusions: string[];
  /** Opt-in language without a deposit-code path. */
  optInRequired: boolean;
  betStake: number | null;
  freeBetAmount: number | null;
  minOdds: number | null;
  bookmaker: string | null;
}

export function emptyPlaybookFacts(): OfferPlaybookFacts {
  return {
    promoCode: null,
    minDeposit: null,
    depositRequired: false,
    rewardEventLabel: null,
    rewardEventDate: null,
    winningsWageringX: null,
    maxConversion: null,
    paymentExclusions: [],
    optInRequired: false,
    betStake: null,
    freeBetAmount: null,
    minOdds: null,
    bookmaker: null,
  };
}

/** Facts subset stored on OfferImportantTerms. */
export function playbookFactsFromImportant(
  important: OfferImportantTerms,
  extras?: {
    betStake?: number | null;
    freeBetAmount?: number | null;
    bookmaker?: string | null;
    optInRequired?: boolean;
  }
): OfferPlaybookFacts {
  return {
    promoCode: important.promoCode,
    minDeposit: important.minDeposit,
    depositRequired: important.depositRequired,
    rewardEventLabel: important.rewardEventLabel,
    rewardEventDate: important.rewardEventDate,
    winningsWageringX: important.winningsWageringX,
    maxConversion: important.maxConversion,
    paymentExclusions: [...important.paymentExclusions],
    optInRequired:
      extras?.optInRequired === true ||
      /\bopt[- ]?in\b/i.test(important.importantNotes),
    betStake: extras?.betStake ?? important.minStake,
    freeBetAmount: extras?.freeBetAmount ?? null,
    minOdds: important.minOdds,
    bookmaker: extras?.bookmaker ?? null,
  };
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function depositTitle(facts: OfferPlaybookFacts): string {
  const code = facts.promoCode?.trim();
  const amt = money(facts.minDeposit);
  if (code && amt) return `Deposit £${amt}+ with code ${code}`;
  if (code) return `Deposit using code ${code}`;
  if (amt) return `Deposit £${amt}+`;
  return "Deposit to unlock the offer";
}

function depositDetail(facts: OfferPlaybookFacts): string {
  const bits: string[] = [];
  const bookie = facts.bookmaker ?? "the bookie";
  bits.push(`Deposit into ${bookie} via the sports cashier.`);
  if (facts.promoCode) bits.push(`Enter promo code ${facts.promoCode} on deposit.`);
  if (facts.minDeposit != null) bits.push(`Minimum £${money(facts.minDeposit)}.`);
  if (facts.paymentExclusions.length > 0) {
    bits.push(`Not available with ${facts.paymentExclusions.join(" or ")}.`);
  }
  return bits.join(" ");
}

function qualifyTitle(facts: OfferPlaybookFacts): string {
  const stake = money(facts.betStake);
  if (stake && facts.minOdds != null) {
    return `Place £${stake} qualifying bet (min odds ${facts.minOdds})`;
  }
  if (stake) return `Place £${stake} qualifying bet`;
  if (facts.minOdds != null) {
    return `Place the qualifying bet (min odds ${facts.minOdds})`;
  }
  return "Place the qualifying bet";
}

/** Tip only — constraints (stake / min odds) live in the title once. */
function qualifyDetail(_facts: OfferPlaybookFacts): string {
  return "Match on the exchange to keep qualifying loss tiny.";
}

function convertTitle(facts: OfferPlaybookFacts): string {
  const fb = money(facts.freeBetAmount);
  if (fb && facts.rewardEventLabel) {
    return `Use £${fb} free bet on ${facts.rewardEventLabel}`;
  }
  if (fb) return `Convert £${fb} free bet (SNR)`;
  return "Convert the free bet";
}

function convertDetail(facts: OfferPlaybookFacts): string {
  const bits: string[] = [];
  if (facts.rewardEventLabel) {
    bits.push(`Free bet locked to ${facts.rewardEventLabel}.`);
  }
  if (facts.rewardEventDate) {
    bits.push(`Event date ${facts.rewardEventDate}.`);
  }
  // Min odds stay on the qualify step title; convert tip is retention only.
  bits.push("Extract SNR on the exchange for best retention.");
  return bits.join(" ");
}

/** Build fresh step definitions (all pending). */
export function deriveOfferPlaybook(facts: OfferPlaybookFacts): OfferPlaybook {
  const steps: OfferPlaybookStep[] = [];
  let order = 0;

  const needsDeposit =
    facts.depositRequired ||
    facts.minDeposit != null ||
    Boolean(facts.promoCode?.trim());

  if (needsDeposit) {
    steps.push({
      id: "deposit",
      kind: "deposit",
      title: depositTitle(facts),
      detail: depositDetail(facts),
      sortOrder: order++,
      status: "pending",
      completion: null,
      completedAt: null,
    });
  } else if (facts.optInRequired) {
    steps.push({
      id: "opt_in",
      kind: "opt_in",
      title: "Opt in to the offer",
      detail: `Confirm opt-in at ${facts.bookmaker ?? "the bookie"} before qualifying.`,
      sortOrder: order++,
      status: "pending",
      completion: null,
      completedAt: null,
    });
  }

  steps.push({
    id: "qualify",
    kind: "qualify",
    title: qualifyTitle(facts),
    detail: qualifyDetail(facts),
    sortOrder: order++,
    status: "pending",
    completion: null,
    completedAt: null,
  });

  steps.push({
    id: "await_award",
    kind: "await_award",
    title: "Await free bet award",
    detail: needsDeposit
      ? "Bonus often stays pending until the qualifying turnover clears."
      : "Wait for the free bet token to land, then convert.",
    sortOrder: order++,
    status: "pending",
    completion: null,
    completedAt: null,
  });

  steps.push({
    id: "convert",
    kind: "convert",
    title: convertTitle(facts),
    detail: convertDetail(facts),
    sortOrder: order++,
    status: "pending",
    completion: null,
    completedAt: null,
  });

  if (facts.winningsWageringX != null && facts.winningsWageringX > 0) {
    const x = facts.winningsWageringX;
    const max =
      facts.maxConversion != null
        ? ` Max conversion £${money(facts.maxConversion)}.`
        : "";
    steps.push({
      id: "clear_wagering",
      kind: "clear_wagering",
      title: `Clear ${x}× wagering on free-bet winnings`,
      detail: `Winnings from the free bet must be wagered ${x}× before withdrawal.${max}`,
      sortOrder: order++,
      status: "pending",
      completion: null,
      completedAt: null,
    });
  }

  steps.push({
    id: "done",
    kind: "done",
    title: "Offer complete",
    detail: "Campaign finished, check capture % against locked EV.",
    sortOrder: order++,
    status: "pending",
    completion: null,
    completedAt: null,
  });

  return { version: 1, steps };
}

/** Keep completion state when regenerating titles/details from new facts. */
export function mergePlaybookProgress(
  previous: OfferPlaybook | null | undefined,
  next: OfferPlaybook
): OfferPlaybook {
  if (!previous?.steps?.length) return next;
  const prevById = new Map(previous.steps.map((s) => [s.id, s]));
  return {
    version: 1,
    steps: next.steps.map((step) => {
      const prev = prevById.get(step.id);
      if (!prev) return step;
      return {
        ...step,
        status: prev.status,
        completion: prev.completion,
        completedAt: prev.completedAt,
        evidence: prev.evidence,
      };
    }),
  };
}

export function markPlaybookStepDone(
  playbook: OfferPlaybook,
  stepId: string,
  now = Date.now()
): OfferPlaybook {
  return {
    version: 1,
    steps: playbook.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status: "done" as const,
            completion: s.completion ?? "manual",
            completedAt: s.completedAt ?? now,
            evidence: s.evidence ?? { kind: "manual" as const },
          }
        : s
    ),
  };
}

function setStepDone(
  step: OfferPlaybookStep,
  now: number,
  completion: "auto" | "manual"
): OfferPlaybookStep {
  if (step.status === "done") return step;
  return {
    ...step,
    status: "done",
    completion,
    completedAt: step.completedAt ?? now,
  };
}

/** Ledger rows that can evidence a bookie deposit (O1 Phase 2). */
export type PlaybookDepositTx = {
  id: number;
  accountId: number;
  amount: number;
  category: string;
  createdAt: number;
};

export type PlaybookDepositAccount = {
  id: number;
  name: string;
  type: string;
};

/**
 * Best-effort: a transfer/top-up into the offer's bookie at/after offer creation
 * meeting minDeposit (or any positive credit when minDeposit is unset).
 */
export function findDepositEvidence(input: {
  bookmaker: string | null | undefined;
  minDeposit: number | null | undefined;
  /** Offer createdAt (or startsOn midnight) — ignore older credits */
  notBeforeMs: number;
  accounts: PlaybookDepositAccount[];
  transactions: PlaybookDepositTx[];
}): { id: number; amount: number } | null {
  const bookie = input.bookmaker?.trim().toLowerCase();
  if (!bookie) return null;
  const accountIds = new Set(
    input.accounts
      .filter(
        (a) =>
          (a.type === "bookie" || a.type === "exchange") &&
          a.name.trim().toLowerCase() === bookie
      )
      .map((a) => a.id)
  );
  if (accountIds.size === 0) return null;

  const min = input.minDeposit != null && input.minDeposit > 0 ? input.minDeposit : 0;
  const hits = input.transactions
    .filter(
      (t) =>
        accountIds.has(t.accountId) &&
        t.amount > 0 &&
        t.createdAt >= input.notBeforeMs &&
        (t.category === "transfer" || t.category === "top_up") &&
        t.amount + 1e-9 >= min
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const hit = hits[0];
  return hit ? { id: hit.id, amount: hit.amount } : null;
}

export function applyDepositEvidenceToPlaybook(
  playbook: OfferPlaybook,
  evidence: { id: number; amount: number } | null,
  now = Date.now()
): OfferPlaybook {
  if (!evidence) return playbook;
  const deposit = playbook.steps.find((s) => s.kind === "deposit");
  if (!deposit || deposit.status === "done") return playbook;
  return {
    version: 1,
    steps: playbook.steps.map((s) =>
      s.id === deposit.id
        ? {
            ...s,
            status: "done" as const,
            completion: "auto" as const,
            completedAt: s.completedAt ?? now,
            evidence: { kind: "transfer" as const, id: evidence.id },
          }
        : s
    ),
  };
}

export type PlaybookWrAccount = {
  id: number;
  name: string;
  type: string;
  wrRemaining: number;
};

function formatWrPounds(n: number): string {
  return n.toFixed(2);
}

/**
 * Clear-wagering safety: only auto-complete after we have seen outstanding WR
 * on the bookie (wr_watch) and it later burns to £0, and convert is complete.
 * Never treats "WR was always £0" as cleared.
 */
export function syncClearWageringFromBookieWr(
  playbook: OfferPlaybook,
  input: {
    bookmaker: string | null | undefined;
    accounts: PlaybookWrAccount[];
    convertComplete: boolean;
  },
  now = Date.now()
): OfferPlaybook {
  const step = playbook.steps.find((s) => s.kind === "clear_wagering");
  if (!step || step.status === "done") return playbook;
  if (!input.convertComplete) return playbook;

  const bookie = input.bookmaker?.trim().toLowerCase();
  if (!bookie) return playbook;
  const account = input.accounts.find(
    (a) => a.type === "bookie" && a.name.trim().toLowerCase() === bookie
  );
  if (!account) return playbook;

  const wr = Math.max(0, account.wrRemaining ?? 0);

  if (wr > 0.005) {
    const detail = `WR £${formatWrPounds(wr)} left on ${account.name}. Place cash bets to burn it, or Mark done when cleared.`;
    if (
      step.evidence?.kind === "wr_watch" &&
      step.evidence.id === account.id &&
      step.detail === detail
    ) {
      return playbook;
    }
    return {
      version: 1,
      steps: playbook.steps.map((s) =>
        s.id === step.id
          ? {
              ...s,
              detail,
              evidence: { kind: "wr_watch" as const, id: account.id },
            }
          : s
      ),
    };
  }

  if (step.evidence?.kind === "wr_watch" && wr <= 0.005) {
    return {
      version: 1,
      steps: playbook.steps.map((s) =>
        s.id === step.id
          ? setStepDone(
              {
                ...s,
                detail: `Wagering cleared on ${account.name}.`,
                evidence: { kind: "wr_watch" as const, id: account.id },
              },
              now,
              "auto"
            )
          : s
      ),
    };
  }

  return playbook;
}

export function playbooksEqual(a: OfferPlaybook, b: OfferPlaybook): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Auto-advance bet-linked steps from campaign profit breakdown.
 * Deposit may also auto via applyDepositEvidenceToPlaybook (ledger).
 */
export function syncPlaybookFromOfferProfit(
  playbook: OfferPlaybook,
  profit: OfferProfitBreakdown,
  now = Date.now()
): OfferPlaybook {
  const stages = profit.freeBetStage;
  const qualStarted =
    profit.qualifyingOpenCount > 0 || profit.qualifyingSettledCount > 0;
  const qualSettled = profit.qualifyingSettledCount > 0;
  const awarded =
    stages === "awarded" ||
    stages === "in_use" ||
    stages === "settled" ||
    profit.freeBetAwarded;
  const converting = stages === "in_use" || stages === "settled";
  const settled = stages === "settled";

  const steps = playbook.steps.map((step) => {
    switch (step.kind) {
      case "qualify":
        return qualStarted ? setStepDone(step, now, "auto") : step;
      case "await_award":
        return awarded || (qualSettled && awarded)
          ? setStepDone(step, now, "auto")
          : awarded
            ? setStepDone(step, now, "auto")
            : step;
      case "convert":
        return converting ? setStepDone(step, now, "auto") : step;
      case "done": {
        const othersDone = playbook.steps
          .filter((s) => s.kind !== "done")
          .every((s) => s.status === "done" || s.status === "skipped");
        return settled || othersDone ? setStepDone(step, now, "auto") : step;
      }
      default:
        return step;
    }
  });

  // If free bet awarded, mark await_award even when qualify still open (early award).
  const synced = steps.map((step) => {
    if (step.kind === "await_award" && awarded) {
      return setStepDone(step, now, "auto");
    }
    return step;
  });

  return { version: 1, steps: synced };
}

/** First incomplete non-done step; null when playbook finished. */
export function currentPlaybookStep(
  playbook: OfferPlaybook | null | undefined
): OfferPlaybookStep | null {
  if (!playbook?.steps?.length) return null;
  const open = playbook.steps.find(
    (s) => s.kind !== "done" && s.status === "pending"
  );
  if (open) return open;
  const doneStep = playbook.steps.find((s) => s.kind === "done");
  if (doneStep && doneStep.status !== "done") return doneStep;
  return null;
}

export function playbookProgress(playbook: OfferPlaybook): {
  currentIndex: number;
  total: number;
  label: string;
} {
  const actionable = playbook.steps.filter((s) => s.kind !== "done");
  const total = Math.max(1, actionable.length);
  const current = currentPlaybookStep(playbook);
  if (!current || current.kind === "done") {
    return { currentIndex: total, total, label: `Step ${total} of ${total}` };
  }
  const idx = actionable.findIndex((s) => s.id === current.id);
  const n = idx >= 0 ? idx + 1 : 1;
  return { currentIndex: n, total, label: `Step ${n} of ${total}` };
}

export function isOfferPlaybook(value: unknown): value is OfferPlaybook {
  if (!value || typeof value !== "object") return false;
  const p = value as OfferPlaybook;
  return p.version === 1 && Array.isArray(p.steps);
}

export function readPlaybookFromRulesJson(
  rules: string | null | undefined
): OfferPlaybook | null {
  if (!rules) return null;
  try {
    const parsed = JSON.parse(rules) as { playbook?: unknown };
    return isOfferPlaybook(parsed.playbook) ? parsed.playbook : null;
  } catch {
    return null;
  }
}

/** Attach or replace playbook on a rules JSON object (racing or promo_terms). */
export function withPlaybookOnRules(
  rulesJson: Record<string, unknown>,
  playbook: OfferPlaybook | null
): Record<string, unknown> {
  if (!playbook) {
    const { playbook: _drop, ...rest } = rulesJson;
    return rest;
  }
  return { ...rulesJson, playbook };
}
