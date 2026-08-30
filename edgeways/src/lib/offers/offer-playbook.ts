/**
 * Offer completion playbook (O1) — ordered operational steps for working a
 * campaign. Financial pipeline stays in pipeline.ts; this is the wizard the
 * user is funnelled through (hybrid: auto from ledger + Mark done).
 */

import type { OfferImportantTerms } from "@/lib/offers/offer-terms";
import type { OfferProfitBreakdown } from "@/lib/services/offers.types";
import {
  isRefundIfOffer,
  REFUND_IF_AWAIT_DETAIL,
  REFUND_IF_AWAIT_TITLE,
  REFUND_IF_QUALIFY_DETAIL,
} from "@/lib/offers/refund-if";

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
  /** Money-back-if-loses: underlay qualify, convert only if the bet loses. */
  refundIf?: boolean;
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
  /** Refund-If / money-back-if-loses: underlay instead of a tight match. */
  refundIf: boolean;
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
    refundIf: false,
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
    refundIf?: boolean;
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
    refundIf: extras?.refundIf === true,
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
  const kind = facts.refundIf ? "refund-if bet" : "qualifying bet";
  if (stake && facts.minOdds != null) {
    return `Place £${stake} ${kind} (min odds ${facts.minOdds})`;
  }
  if (stake) return `Place £${stake} ${kind}`;
  if (facts.minOdds != null) {
    return `Place the ${kind} (min odds ${facts.minOdds})`;
  }
  return `Place the ${kind}`;
}

/** Tip only — constraints (stake / min odds) live in the title once. */
function qualifyDetail(facts: OfferPlaybookFacts): string {
  if (facts.refundIf) return REFUND_IF_QUALIFY_DETAIL;
  return "Match on the exchange to keep qualifying loss tiny.";
}

function convertTitle(facts: OfferPlaybookFacts): string {
  const fb = money(facts.freeBetAmount);
  const min =
    facts.rewardEventLabel && facts.minOdds != null
      ? ` (min odds ${facts.minOdds})`
      : "";
  if (fb && facts.rewardEventLabel) {
    return `Use £${fb} free bet on ${facts.rewardEventLabel}${min}`;
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
    title: facts.refundIf ? REFUND_IF_AWAIT_TITLE : "Await free bet award",
    detail: facts.refundIf
      ? REFUND_IF_AWAIT_DETAIL
      : needsDeposit
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

  return { version: 1, refundIf: facts.refundIf || undefined, steps };
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
    ...(next.refundIf || previous.refundIf ? { refundIf: true } : {}),
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

/** Hosted and localhost PATCH: mark a step and return the next rules JSON. */
export function rulesAfterPlaybookStep(
  rules: string | null | undefined,
  profit: OfferProfitBreakdown,
  stepId: string,
  now = Date.now()
): { ok: true; rules: string } | { ok: false; error: "no_playbook" | "invalid" } {
  try {
    const parsedRules = rules
      ? (JSON.parse(rules) as Record<string, unknown>)
      : { type: "promo_terms" };
    const pb = readPlaybookFromRulesJson(rules);
    if (!pb) return { ok: false, error: "no_playbook" };
    const synced = syncPlaybookFromOfferProfit(pb, profit, now);
    const marked = markPlaybookStepDone(synced, stepId, now);
    return { ok: true, rules: JSON.stringify(withPlaybookOnRules(parsedRules, marked)) };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

export function markPlaybookStepDone(
  playbook: OfferPlaybook,
  stepId: string,
  now = Date.now()
): OfferPlaybook {
  return {
    version: 1,
    ...(playbook.refundIf ? { refundIf: true } : {}),
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
  const refundIfWon =
    playbook.refundIf === true &&
    stages === "not_awarded" &&
    qualSettled &&
    profit.qualifyingOpenCount === 0 &&
    !profit.freeBetAwarded &&
    profit.freeBetOpenCount === 0 &&
    profit.freeBetSettledCount === 0;

  const skipIfWon = (step: OfferPlaybookStep): OfferPlaybookStep => {
    if (!refundIfWon || step.status === "done") return step;
    return { ...step, status: "skipped" };
  };

  const steps = playbook.steps.map((step) => {
    switch (step.kind) {
      case "deposit":
      case "opt_in":
        // A linked qualifier is proof they funded the bookie and opted in.
        return qualStarted ? setStepDone(step, now, "auto") : step;
      case "qualify":
        return qualStarted ? setStepDone(step, now, "auto") : step;
      case "await_award":
        if (awarded) return setStepDone(step, now, "auto");
        return skipIfWon(step);
      case "convert":
        if (converting) return setStepDone(step, now, "auto");
        return skipIfWon(step);
      case "done": {
        const othersDone = playbook.steps
          .filter((s) => s.kind !== "done")
          .every((s) => s.status === "done" || s.status === "skipped");
        return settled || othersDone || refundIfWon ? setStepDone(step, now, "auto") : step;
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

  return {
    version: 1,
    ...(playbook.refundIf ? { refundIf: true } : {}),
    steps: synced,
  };
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

/** Rewrite qualify/await copy on existing campaigns detected as Refund-If. */
export function hydrateRefundIfPlaybook(
  playbook: OfferPlaybook,
  offer: { title?: string | null; description?: string | null; rules?: string | null }
): OfferPlaybook {
  if (!playbook.refundIf && !isRefundIfOffer(offer)) return playbook;
  const qualify = playbook.steps.find((s) => s.kind === "qualify");
  const titleAlready =
    qualify != null && !/qualifying bet/i.test(qualify.title);
  if (playbook.refundIf && qualify?.detail === REFUND_IF_QUALIFY_DETAIL && titleAlready) {
    return playbook;
  }
  return {
    version: 1,
    refundIf: true,
    steps: playbook.steps.map((s) => {
      if (s.kind === "qualify") {
        return {
          ...s,
          title: s.title.replace(/qualifying bet/gi, "refund-if bet"),
          detail: REFUND_IF_QUALIFY_DETAIL,
        };
      }
      if (s.kind === "await_award") {
        return { ...s, title: REFUND_IF_AWAIT_TITLE, detail: REFUND_IF_AWAIT_DETAIL };
      }
      return s;
    }),
  };
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

/** Read, rewrite Refund-If copy, then sync completion from campaign profit. */
export function playbookFromOffer(
  offer: {
    title?: string | null;
    description?: string | null;
    rules?: string | null;
    profit?: OfferProfitBreakdown;
  },
  now = Date.now()
): OfferPlaybook | null {
  const raw = readPlaybookFromRulesJson(offer.rules);
  if (!raw) return null;
  const hydrated = hydrateRefundIfPlaybook(raw, offer);
  return offer.profit
    ? syncPlaybookFromOfferProfit(hydrated, offer.profit, now)
    : hydrated;
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
