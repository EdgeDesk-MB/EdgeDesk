/**
 * In-play Acca / Bet Builder / Systems progress for Offers calendar and
 * campaign cards. The financial pipeline stays in pipeline.ts; this names
 * the next desk action (usually a lay) once a run is linked.
 */

export type OfferDeskKind = "acca" | "bet_builder" | "systems";

export interface OfferDeskProgress {
  kind: OfferDeskKind;
  href: "/acca" | "/bet-builder" | "/systems";
  runId: number;
  /** Short campaign / calendar line, e.g. "Lay 2nd leg". */
  actionTitle: string;
  actionDetail: string;
  done: number;
  total: number;
  stageLabel: string;
  progressCaption: string;
  nextCaption: string | null;
  /** True when the user should open the desk now (unlaid next, or unlaid combo). */
  needsAction: boolean;
}

export type AccaDeskSnapshot = {
  id: number;
  offerId: number | null;
  status: string;
  method: string;
  noLay?: number | null;
  wholeLayStake: number | null;
  legs: Array<{
    seq: number;
    label: string;
    result: "pending" | "won" | "lost" | "void";
    layStake: number | null;
  }>;
};

export type BetBuilderDeskSnapshot = {
  id: number;
  offerId: number | null;
  status: string;
  method: "combined" | "no_lay";
  wholeLayStake: number | null;
  selectionCount: number;
};

export type SystemDeskSnapshot = {
  id: number;
  offerId: number | null;
  status: string;
  legs: Array<{
    seq: number;
    label: string;
    /** "placed" (place terms) counts as settled, not won or lost. */
    result: "pending" | "won" | "placed" | "lost" | "void";
  }>;
};

export function deskKindLabel(kind: OfferDeskKind): string {
  if (kind === "acca") return "Acca Desk";
  if (kind === "bet_builder") return "Bet Builder Desk";
  return "Systems Desk";
}

export function ordinalLeg(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function isWholeComboMethod(method: string): boolean {
  return method === "combined" || method === "insurance_whole";
}

function nextUnlaidAccaLeg(legs: AccaDeskSnapshot["legs"]): AccaDeskSnapshot["legs"][number] | null {
  const live = [...legs].sort((a, b) => a.seq - b.seq);
  if (live.some((l) => l.result === "lost")) return null;
  return (
    live.find((leg) => {
      if (leg.result !== "pending") return false;
      if (leg.layStake != null && leg.layStake > 0) return false;
      return !live.some((earlier) => earlier.seq < leg.seq && earlier.result === "pending");
    }) ?? null
  );
}

export function progressFromAcca(run: AccaDeskSnapshot): OfferDeskProgress | null {
  if (run.status !== "active" || run.offerId == null) return null;
  if (run.legs.some((l) => l.result === "lost")) return null;

  const live = run.legs.filter((l) => l.result !== "void");
  if (live.length === 0) return null;

  if (isWholeComboMethod(run.method)) {
    if (run.noLay === 1) {
      return {
        kind: "acca",
        href: "/acca",
        runId: run.id,
        actionTitle: "Awaiting result",
        actionDetail: "The combo is in play. Open Acca Desk if a result needs confirming.",
        done: 0,
        total: live.length,
        stageLabel: "Awaiting result",
        progressCaption: `${live.length} leg${live.length === 1 ? "" : "s"}`,
        nextCaption: null,
        needsAction: false,
      };
    }
    const laid = run.wholeLayStake != null && run.wholeLayStake > 0;
    if (!laid) {
      return {
        kind: "acca",
        href: "/acca",
        runId: run.id,
        actionTitle: "Lay the combo",
        actionDetail: "Open Acca Desk to lay the acca at the combined price.",
        done: 0,
        total: 1,
        stageLabel: "Lay the combo",
        progressCaption: "0/1 laid",
        nextCaption: "Combined lay",
        needsAction: true,
      };
    }
    return {
      kind: "acca",
      href: "/acca",
      runId: run.id,
      actionTitle: "Awaiting result",
      actionDetail: "Combo is laid. Open Acca Desk if a result needs confirming.",
      done: 1,
      total: 1,
      stageLabel: "Awaiting result",
      progressCaption: "1/1 laid",
      nextCaption: null,
      needsAction: false,
    };
  }

  const laid = live.filter((l) => l.layStake != null && l.layStake > 0).length;
  const next = nextUnlaidAccaLeg(run.legs);
  if (next) {
    const title = `Lay ${ordinalLeg(next.seq)} leg`;
    return {
      kind: "acca",
      href: "/acca",
      runId: run.id,
      actionTitle: title,
      actionDetail: `Lay ${next.label} on Acca Desk.`,
      done: laid,
      total: live.length,
      stageLabel: title,
      progressCaption: `${laid}/${live.length} laid`,
      nextCaption: next.label,
      needsAction: true,
    };
  }

  const nextPending = [...live].sort((a, b) => a.seq - b.seq).find((l) => l.result === "pending");
  const laterUnlaid = live.some(
    (l) => l.result === "pending" && (l.layStake == null || l.layStake <= 0)
  );
  return {
    kind: "acca",
    href: "/acca",
    runId: run.id,
    actionTitle: laterUnlaid ? "Awaiting result to lay next" : "Awaiting result",
    actionDetail: laterUnlaid
      ? "Once this leg wins, open Acca Desk to lay the next one."
      : "Every laid leg is on. Open Acca Desk if a result needs confirming.",
    done: laid,
    total: live.length,
    stageLabel: "Awaiting result",
    progressCaption: `${laid}/${live.length} laid`,
    nextCaption: laterUnlaid ? "Lay next after this result" : (nextPending?.label ?? null),
    needsAction: false,
  };
}

export function progressFromBetBuilder(run: BetBuilderDeskSnapshot): OfferDeskProgress | null {
  if (run.status !== "active" || run.offerId == null) return null;
  const selections = Math.max(run.selectionCount, 1);
  if (run.method === "no_lay") {
    return {
      kind: "bet_builder",
      href: "/bet-builder",
      runId: run.id,
      actionTitle: "Awaiting result",
      actionDetail: "The bet builder is in play. Open Bet Builder Desk if a result needs confirming.",
      done: 0,
      total: selections,
      stageLabel: "Awaiting result",
      progressCaption: `${selections} selection${selections === 1 ? "" : "s"}`,
      nextCaption: null,
      needsAction: false,
    };
  }
  const laid = run.wholeLayStake != null && run.wholeLayStake > 0;
  if (!laid) {
    return {
      kind: "bet_builder",
      href: "/bet-builder",
      runId: run.id,
      actionTitle: "Lay the bet builder",
      actionDetail: "Open Bet Builder Desk to lay the combined builder.",
      done: 0,
      total: 1,
      stageLabel: "Lay the bet builder",
      progressCaption: `${selections} selection${selections === 1 ? "" : "s"} · 0/1 laid`,
      nextCaption: "Combined lay",
      needsAction: true,
    };
  }
  return {
    kind: "bet_builder",
    href: "/bet-builder",
    runId: run.id,
    actionTitle: "Awaiting result",
    actionDetail: "Builder is laid. Open Bet Builder Desk if a result needs confirming.",
    done: 1,
    total: 1,
    stageLabel: "Awaiting result",
    progressCaption: `${selections} selection${selections === 1 ? "" : "s"} · 1/1 laid`,
    nextCaption: null,
    needsAction: false,
  };
}

export function progressFromSystems(run: SystemDeskSnapshot): OfferDeskProgress | null {
  if (run.status !== "active" || run.offerId == null) return null;
  const live = run.legs.filter((l) => l.result !== "void");
  if (live.length === 0) return null;
  if (live.some((l) => l.result === "lost") && live.every((l) => l.result !== "pending")) {
    return null;
  }
  const settled = live.filter((l) => l.result !== "pending").length;
  const next = [...live].sort((a, b) => a.seq - b.seq).find((l) => l.result === "pending");
  const stillOpen = next != null;
  if (!stillOpen) return null;
  return {
    kind: "systems",
    href: "/systems",
    runId: run.id,
    actionTitle: "Awaiting remaining legs",
    actionDetail: next
      ? `Next: ${next.label}. Open Systems Desk if a result needs confirming.`
      : "Open Systems Desk if a result needs confirming.",
    done: settled,
    total: live.length,
    stageLabel: "Awaiting remaining legs",
    progressCaption: `${settled}/${live.length} settled`,
    nextCaption: next?.label ?? null,
    needsAction: false,
  };
}

export function indexOfferDeskProgress(input: {
  acca?: AccaDeskSnapshot[];
  betBuilder?: BetBuilderDeskSnapshot[];
  systems?: SystemDeskSnapshot[];
}): Map<number, OfferDeskProgress> {
  const byOffer = new Map<number, OfferDeskProgress>();

  const consider = (progress: OfferDeskProgress | null, offerId: number | null) => {
    if (!progress || offerId == null) return;
    const prev = byOffer.get(offerId);
    if (!prev || (progress.needsAction && !prev.needsAction)) {
      byOffer.set(offerId, progress);
    }
  };

  for (const run of input.acca ?? []) consider(progressFromAcca(run), run.offerId);
  for (const run of input.betBuilder ?? []) consider(progressFromBetBuilder(run), run.offerId);
  for (const run of input.systems ?? []) consider(progressFromSystems(run), run.offerId);
  return byOffer;
}
