"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AccaTrackerLegsSummary } from "@/components/acca/acca-legs-timeline";
import { BetBuilderTrackerSummary } from "@/components/bet-builder/tracker-summary";
import { SystemsTrackerSummary } from "@/components/systems/tracker-summary";
import { BetLogTable } from "@/components/tracker/bet-log-table";
import type {
  AccaLegRow,
  AccaRunRow,
  BetBuilderRunRow,
  BetBuilderSelectionRow,
  BetRow,
  EventRow,
  SystemLegRow,
  SystemRunRow,
} from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { PromoAwardsByBetId } from "@/lib/bet-outcomes";
import type { BetCampaignGroup } from "@/lib/bets/desk-queues";
import {
  betsForAccaRun,
  isAccaDeskBack,
  isAccaDeskConvertBack,
} from "@/lib/bets/acca-desk-bets";
import { isBetBuilderDeskBack } from "@/lib/bets/bet-builder-desk-bets";
import { isSystemsDeskBack } from "@/lib/bets/systems-desk-bets";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { formatOfferStatusDisplay } from "@/lib/offers/offer-expiry";
import { isOfferExpired, offerInactiveFigureClass } from "@/lib/offers/offer-inactive-ui";
import { campaignHeaderBand, panelSurface } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export type AccaRunViewLite = { run: AccaRunRow; legs: AccaLegRow[] };
export type BetBuilderRunViewLite = {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
};
export type SystemRunViewLite = {
  run: SystemRunRow;
  legs: SystemLegRow[];
};

function accasForGroup(
  group: BetCampaignGroup,
  accaRuns: AccaRunViewLite[]
): AccaRunViewLite[] {
  const backIds = new Set(group.bets.filter(isAccaDeskBack).map((b) => b.id));
  const matched = accaRuns.filter(
    (v) =>
      (v.run.backBetId != null && backIds.has(v.run.backBetId)) ||
      (group.offerId != null && v.run.offerId === group.offerId)
  );
  const backById = new Map(group.bets.filter(isAccaDeskBack).map((b) => [b.id, b]));
  // Narrative: qualify runs first, then convert; oldest within each band.
  return matched.sort((a, b) => {
    const aBack = a.run.backBetId != null ? backById.get(a.run.backBetId) : undefined;
    const bBack = b.run.backBetId != null ? backById.get(b.run.backBetId) : undefined;
    const aConvert = aBack ? isAccaDeskConvertBack(aBack) : false;
    const bConvert = bBack ? isAccaDeskConvertBack(bBack) : false;
    if (aConvert !== bConvert) return aConvert ? 1 : -1;
    return a.run.createdAt - b.run.createdAt || a.run.id - b.run.id;
  });
}

function accaStageForRun(
  view: AccaRunViewLite,
  group: BetCampaignGroup
): "qualify" | "convert" | undefined {
  const back =
    view.run.backBetId != null
      ? group.bets.find((b) => b.id === view.run.backBetId)
      : undefined;
  if (!back || !isAccaDeskBack(back)) return undefined;
  return isAccaDeskConvertBack(back) ? "convert" : "qualify";
}

function betBuilderForGroup(
  group: BetCampaignGroup,
  bbRuns: BetBuilderRunViewLite[]
): BetBuilderRunViewLite | null {
  const backIds = new Set(group.bets.filter(isBetBuilderDeskBack).map((b) => b.id));
  return (
    bbRuns.find(
      (v) =>
        (v.run.backBetId != null && backIds.has(v.run.backBetId)) ||
        (group.offerId != null && v.run.offerId === group.offerId)
    ) ?? null
  );
}

function systemForGroup(
  group: BetCampaignGroup,
  systemRuns: SystemRunViewLite[]
): SystemRunViewLite | null {
  const backIds = new Set(group.bets.filter(isSystemsDeskBack).map((b) => b.id));
  return (
    systemRuns.find(
      (v) =>
        (v.run.backBetId != null && backIds.has(v.run.backBetId)) ||
        (group.offerId != null && v.run.offerId === group.offerId)
    ) ?? null
  );
}

function BetLogBlock({
  bets,
  events,
  promoAwards,
  offerById,
  eventById,
  highlightId,
  onEdit,
  onPatch,
  onPatchEvent,
  onLogged,
}: {
  bets: BetRow[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  onPatchEvent: (id: number, json: Record<string, unknown>, message: string) => void;
  onLogged: () => void;
}) {
  if (bets.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <BetLogTable
        bets={bets}
        events={events}
        promoAwards={promoAwards}
        offerById={offerById}
        eventById={eventById}
        highlightId={highlightId}
        onEdit={onEdit}
        onPatch={onPatch}
        onPatchEvent={onPatchEvent}
        onLogged={onLogged}
      />
    </div>
  );
}

export function BetCampaignSections({
  groups,
  events,
  promoAwards,
  offerById,
  eventById,
  highlightId,
  accaRuns = [],
  betBuilderRuns = [],
  systemRuns = [],
  now = Date.now(),
  onEdit,
  onPatch,
  onPatchEvent,
  onLogged,
}: {
  groups: BetCampaignGroup[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  accaRuns?: AccaRunViewLite[];
  betBuilderRuns?: BetBuilderRunViewLite[];
  systemRuns?: SystemRunViewLite[];
  now?: number;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  onPatchEvent: (id: number, json: Record<string, unknown>, message: string) => void;
  onLogged: () => void;
}) {
  const logProps = {
    events,
    promoAwards,
    offerById,
    eventById,
    highlightId,
    onEdit,
    onPatch,
    onPatchEvent,
    onLogged,
  };

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const accas = accasForGroup(group, accaRuns);
        const bb = accas.length > 0 ? null : betBuilderForGroup(group, betBuilderRuns);
        const system =
          accas.length > 0 || bb ? null : systemForGroup(group, systemRuns);
        const activeAcca = accas.find((v) => v.run.status === "active") ?? accas[0];

        const claimedIds = new Set<number>();
        const accaBlocks = accas.map((acca) => {
          const bets = betsForAccaRun(acca.run, acca.legs, group.bets);
          for (const b of bets) claimedIds.add(b.id);
          return { acca, bets };
        });
        const leftoverBets = group.bets.filter((b) => !claimedIds.has(b.id));

        return (
          <section
            key={group.offerId ?? "orphans"}
            className={cn(panelSurface, "min-w-0 rounded-lg")}
          >
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5",
                campaignHeaderBand
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {group.offer?.bookmaker ? <VenueBadge name={group.offer.bookmaker} /> : null}
                  {group.offerId != null ? (
                    <Link
                      href={`/offers?highlight=${group.offerId}`}
                      className="truncate text-sm font-bold text-foreground hover:text-primary-text hover:underline"
                    >
                      {group.title}
                    </Link>
                  ) : (
                    <h3 className="truncate text-sm font-bold text-foreground">{group.title}</h3>
                  )}
                  {group.offer ? (
                    <Badge variant="outline" className="text-[11px] uppercase">
                      {formatOfferStatusDisplay(group.offer)}
                    </Badge>
                  ) : null}
                  {accas.length > 0 ? (
                    <Badge variant="outline" className="text-[11px]">
                      {accas.length > 1
                        ? `Acca · ${accas.length} runs`
                        : `Acca · ${activeAcca?.legs.length ?? 0} legs`}
                    </Badge>
                  ) : null}
                  {bb ? (
                    <Badge variant="outline" className="text-[11px]">
                      Bet builder · {bb.selections.length} sel
                    </Badge>
                  ) : null}
                  {system ? (
                    <Badge variant="outline" className="text-[11px]">
                      System · {system.legs.length} sel
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {group.bets.length} bet{group.bets.length === 1 ? "" : "s"}
                  {group.openCount > 0 ? ` · ${group.openCount} open` : ""}
                  {group.needsLayCount > 0 ? ` · ${group.needsLayCount} unlayed` : ""}
                </p>
              </div>
              {group.offer ? (
                <div className="shrink-0 text-right text-xs tabular-nums">
                  <div className="text-muted-foreground">
                    Campaign P&L
                    {Math.abs(group.offer.profit.openExpectedProfit) >= 0.005 ? (
                      <span className="ml-1 font-normal normal-case tracking-normal text-[11px]">
                        (incl. open)
                      </span>
                    ) : null}
                  </div>
                  <MoneyFlow
                    value={group.offer.profit.totalProfit}
                    signColor={!isOfferExpired(group.offer)}
                    className={cn(
                      "text-[1.1rem] font-bold leading-tight",
                      offerInactiveFigureClass(isOfferExpired(group.offer))
                    )}
                  />
                </div>
              ) : null}
            </div>

            {accaBlocks.length > 0 ? (
              accaBlocks.map(({ acca, bets }) => (
                <div key={acca.run.id}>
                  <AccaTrackerLegsSummary
                    run={acca.run}
                    legs={acca.legs}
                    now={now}
                    eventById={eventById}
                    stage={accaStageForRun(acca, group)}
                  />
                  <BetLogBlock bets={bets} {...logProps} />
                </div>
              ))
            ) : (
              <>
                {bb ? (
                  <BetBuilderTrackerSummary run={bb.run} selections={bb.selections} />
                ) : null}
                {system ? (
                  <SystemsTrackerSummary
                    run={system.run}
                    legs={system.legs}
                    eventById={eventById}
                  />
                ) : null}
                <BetLogBlock bets={group.bets} {...logProps} />
              </>
            )}

            {accaBlocks.length > 0 && leftoverBets.length > 0 ? (
              <BetLogBlock bets={leftoverBets} {...logProps} />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
