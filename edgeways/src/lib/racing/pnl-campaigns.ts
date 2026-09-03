/**
 * Map Acca / Bet Builder / Systems desk runs onto Racing Desk day-P&L
 * campaign inputs. Valuation matches Home: settled = sum of linked bets,
 * active Acca = square provisional.
 */
import {
  accaCampaignSettledProfit,
  accaRunLinkedBetIds,
  accaRunSquareProvisional,
  type AccaRunForProvisional,
} from "@/lib/pnl/acca-provisional";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";
import { roundPence } from "@/lib/calc/money";
import type { BetRow } from "@/lib/db/schema";
import type { RacingPnlCampaignInput } from "@/lib/racing/pnl-today";

type DeskBetRef = Pick<BetRow, "status" | "actualProfit" | "expectedProfit">;

function settledLinkedProfit(
  ids: number[],
  betsById: Map<number, DeskBetRef>
): number | null {
  let profit = 0;
  let any = false;
  for (const id of ids) {
    const bet = betsById.get(id);
    if (!bet || bet.status === "open" || bet.status === "void") continue;
    if (bet.actualProfit == null) continue;
    any = true;
    profit += bet.actualProfit;
  }
  return any ? roundPence(profit) : null;
}

function openLinkedProfit(
  ids: number[],
  betsById: Map<number, DeskBetRef>
): number | null {
  let profit = 0;
  let any = false;
  for (const id of ids) {
    const bet = betsById.get(id);
    if (!bet) continue;
    const value = openBetExpectedProfit(bet);
    if (value == null) continue;
    any = true;
    profit += value;
  }
  return any ? roundPence(profit) : null;
}

export type RacingPnlBetBuilderRun = {
  run: {
    id: number;
    label: string;
    status: string;
    backBetId: number | null;
    wholeLayBetId: number | null;
    eventId: number | null;
  };
};

export type RacingPnlSystemRun = {
  run: {
    id: number;
    label: string;
    status: string;
    backBetId: number | null;
  };
  legs: Array<{ eventId: number | null; result: string }>;
};

export function racingDeskPnlCampaigns(input: {
  betsById: Map<number, DeskBetRef>;
  acca?: AccaRunForProvisional[];
  betBuilder?: RacingPnlBetBuilderRun[];
  systems?: RacingPnlSystemRun[];
}): RacingPnlCampaignInput[] {
  const out: RacingPnlCampaignInput[] = [];

  for (const bundle of input.acca ?? []) {
    const linkedBetIds = accaRunLinkedBetIds(bundle);
    const square = accaRunSquareProvisional(bundle);
    out.push({
      id: bundle.run.id,
      kind: "acca",
      label: bundle.run.label,
      status: bundle.run.status,
      settledProfit: accaCampaignSettledProfit(bundle, input.betsById),
      openProfit: square?.value ?? null,
      linkedBetIds,
      eventIds: bundle.legs
        .map((l) => l.eventId)
        .filter((id): id is number => id != null),
      decidedEventIds: bundle.legs
        .filter((l) => l.result !== "pending" && l.eventId != null)
        .map((l) => l.eventId as number),
    });
  }

  for (const { run } of input.betBuilder ?? []) {
    const linkedBetIds = [run.backBetId, run.wholeLayBetId].filter(
      (id): id is number => id != null
    );
    const eventIds = run.eventId != null ? [run.eventId] : [];
    out.push({
      id: run.id,
      kind: "bet_builder",
      label: run.label,
      status: run.status,
      settledProfit: settledLinkedProfit(linkedBetIds, input.betsById),
      openProfit: openLinkedProfit(linkedBetIds, input.betsById),
      linkedBetIds,
      eventIds,
      decidedEventIds: run.status === "completed" ? eventIds : [],
    });
  }

  for (const { run, legs } of input.systems ?? []) {
    const linkedBetIds = run.backBetId != null ? [run.backBetId] : [];
    out.push({
      id: run.id,
      kind: "systems",
      label: run.label,
      status: run.status,
      settledProfit: settledLinkedProfit(linkedBetIds, input.betsById),
      openProfit: openLinkedProfit(linkedBetIds, input.betsById),
      linkedBetIds,
      eventIds: legs
        .map((l) => l.eventId)
        .filter((id): id is number => id != null),
      decidedEventIds: legs
        .filter((l) => l.result !== "pending" && l.eventId != null)
        .map((l) => l.eventId as number),
    });
  }

  return out;
}
