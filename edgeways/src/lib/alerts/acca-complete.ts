/**
 * Acca Desk campaign-complete alert. The back ticket P&L is not what the
 * punter made; this summarises the run once the last deciding leg lands.
 */

import { accaFoldName } from "@/lib/bets/acca-fold-name";
import {
  accaCampaignProfit,
  accaSquareProvisional,
  type AccaMethodKind,
} from "@/lib/calc/acca-workflow";
import { isRecentSettlement } from "./settled-since-poll";
import type { EdgeAlert } from "./types";

export function accaCompleteAlertKey(runId: number): string {
  return `acca_complete:${runId}`;
}

export type AccaCompleteKind = "won" | "lost" | "busted" | "locked" | "void";

export interface AccaCompleteAlertRun {
  id: number;
  label: string;
  method: AccaMethodKind;
  bookmaker: string | null;
  offerTitle: string | null;
  stake: number;
  commission: number;
  boostPct: number | null;
  backBetType: string | null;
  refundAmount: number | null;
  noLay: number;
  wholeLayStake: number | null;
  wholeLayOdds: number | null;
  legs: Array<{
    seq: number;
    label: string;
    result: "pending" | "won" | "lost" | "void";
    backOdds: number;
    layStake: number | null;
    layOdds: number | null;
  }>;
}

function isLaid(leg: { layStake: number | null; layOdds: number | null }): boolean {
  return (
    leg.layStake != null &&
    leg.layStake > 0 &&
    leg.layOdds != null &&
    leg.layOdds > 1
  );
}

function liveLegs(legs: AccaCompleteAlertRun["legs"]) {
  return [...legs]
    .filter((l) => l.result !== "void")
    .sort((a, b) => a.seq - b.seq);
}

function wholeLaid(run: Pick<AccaCompleteAlertRun, "wholeLayStake" | "wholeLayOdds">): boolean {
  return (
    run.wholeLayStake != null &&
    run.wholeLayStake > 0 &&
    run.wholeLayOdds != null &&
    run.wholeLayOdds > 1
  );
}

function wholeEqualised(run: AccaCompleteAlertRun): boolean {
  if (!wholeLaid(run)) return false;
  const pending = run.legs.map((l) =>
    l.result === "void" ? l : { ...l, result: "pending" as const }
  );
  const square = accaSquareProvisional(
    {
      stake: run.stake,
      commission: run.commission,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType: run.backBetType,
    },
    pending
  );
  return square?.kind === "locked";
}

export function classifyAccaComplete(run: AccaCompleteAlertRun): AccaCompleteKind {
  const live = liveLegs(run.legs);
  if (run.legs.length > 0 && run.legs.every((l) => l.result === "void")) return "void";
  if (live.length === 0) return "void";

  const lost = live.filter((l) => l.result === "lost");
  const last = live[live.length - 1]!;

  if (run.method === "insurance_whole" || run.method === "combined") {
    if (wholeEqualised(run)) return "locked";
    return lost.length === 0 ? "won" : "lost";
  }

  if (lost.length === 0) {
    if (run.method === "sequential" && isLaid(last)) return "locked";
    return "won";
  }

  if (
    run.method === "sequential" &&
    last.result === "lost" &&
    isLaid(last) &&
    lost.every((l) => l.seq === last.seq)
  ) {
    return "locked";
  }

  const firstLost = lost[0]!;
  return isLaid(firstLost) ? "busted" : "lost";
}

function outcomeSuffix(kind: AccaCompleteKind): string {
  switch (kind) {
    case "won":
      return "Acca won";
    case "lost":
      return "Acca lost";
    case "busted":
      return "Acca busted";
    case "locked":
      return "Acca locked";
    case "void":
      return "Acca void";
  }
}

function formatSignedTitle(profit: number, suffix: string): string {
  if (profit > 0) return `You just made £${profit.toFixed(2)} · ${suffix}`;
  if (profit < 0) return `-£${Math.abs(profit).toFixed(2)} settled · ${suffix}`;
  return `£0.00 settled · ${suffix}`;
}

function refundDue(run: AccaCompleteAlertRun): number | null {
  if (run.method !== "insurance_legs" && run.method !== "insurance_whole") return null;
  const lostCount = run.legs.filter((l) => l.result === "lost").length;
  if (lostCount !== 1) return null;
  const amount = run.refundAmount ?? 0;
  return amount > 0 ? amount : null;
}

export function accaCompleteAlertCopy(run: AccaCompleteAlertRun): {
  title: string;
  body: string;
  kind: AccaCompleteKind;
  profit: number;
} {
  const kind = classifyAccaComplete(run);
  const profit = accaCampaignProfit(
    {
      stake: run.stake,
      commission: run.commission,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType: run.backBetType,
    },
    run.legs
  );

  if (kind === "void") {
    return {
      title: "Acca void · stakes returned",
      body: formatAccaCompleteBody(run, kind),
      kind,
      profit: 0,
    };
  }

  return {
    title: formatSignedTitle(profit, outcomeSuffix(kind)),
    body: formatAccaCompleteBody(run, kind),
    kind,
    profit,
  };
}

export function formatAccaCompleteBody(
  run: AccaCompleteAlertRun,
  kind: AccaCompleteKind = classifyAccaComplete(run)
): string {
  const type =
    run.backBetType === "free_snr" || run.backBetType === "free_sr"
      ? "Free bet"
      : "Qualifying";
  const subject = run.offerTitle?.trim() || run.label.trim() || "Acca";
  const parts = [`${type} · ${subject}`];

  const live = liveLegs(run.legs);
  const fold = accaFoldName(live.length);
  const laid =
    run.legs.filter((l) => isLaid(l)).length + (wholeLaid(run) ? 1 : 0);
  if (fold) parts.push(`${fold} · ${laid} laid`);
  else if (live.length > 0) {
    parts.push(`${live.length} leg${live.length === 1 ? "" : "s"} · ${laid} laid`);
  }

  if (kind === "busted") {
    const bust = live.find((l) => l.result === "lost");
    const name = bust?.label.trim();
    if (name) parts.push(`Busted at ${name}`);
  }

  const refund = refundDue(run);
  if (refund != null) parts.push(`Claim the £${refund.toFixed(2)} refund`);
  if (run.noLay === 1) parts.push("No lay");

  return parts.join(" · ");
}

export function accaCampaignCompleteAlert(run: AccaCompleteAlertRun): EdgeAlert {
  const copy = accaCompleteAlertCopy(run);
  const tone =
    copy.kind === "void"
      ? null
      : copy.profit > 0
        ? "positive"
        : copy.profit < 0
          ? "negative"
          : null;
  return {
    key: accaCompleteAlertKey(run.id),
    kind: "acca_complete",
    title: copy.title,
    body: copy.body,
    bookmaker: run.bookmaker?.trim() || null,
    tone,
    href: "/acca",
  };
}

/** Same announce window as per-bet settlement: first poll silent, then transitions. */
export function accaRunIdsToAnnounce(
  previous: Map<number, string> | null,
  runs: Array<{ id: number; status: string; settledAt: number | null }>,
  now: number
): number[] {
  if (previous == null) return [];
  const ids: number[] = [];
  for (const run of runs) {
    if (run.status !== "completed") continue;
    const prev = previous.get(run.id);
    if (prev === "completed") continue;
    if (prev === "active" || prev === "abandoned") {
      ids.push(run.id);
      continue;
    }
    if (prev == null && isRecentSettlement(run.settledAt, now)) ids.push(run.id);
  }
  return ids;
}

export function mergeAccaStatusMap(
  previous: Map<number, string> | null,
  runs: Array<{ id: number; status: string }>
): Map<number, string> {
  const next = new Map(previous ?? []);
  for (const run of runs) next.set(run.id, run.status);
  return next;
}
