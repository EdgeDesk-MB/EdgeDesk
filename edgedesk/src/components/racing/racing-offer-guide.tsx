"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RaceOfferTag, RacingDeskRace } from "@/lib/racing-desk/types";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import {
  edgePlayForRaceOffer,
  findOfferTag,
  offerTagDisplayEv,
  qualifyingOfferTags,
} from "@/lib/racing/offer-tags";
import { formatClockTime } from "@/lib/time-format";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { VenueBadge } from "@/components/venue-badge";
import { MoneyFlow } from "@/components/money-flow";
import { OfferConfidenceBadge } from "@/components/offers/offer-confidence-badge";
import { useAppState } from "@/hooks/use-app-state";
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronDown,
  Gift,
  ListChecks,
  NotebookPen,
  Pin,
  Sparkles,
} from "lucide-react";

export interface RacingOfferGuideProps {
  race: RacingDeskRace;
  /** Modelled Offer Edge plays for today (same payload as Race picks). */
  edgePlays?: OfferEdgePlay[];
  dataSource?: "demo" | "racing-api" | "error";
  onBack: (runnerName: string, offerId: number) => void;
  onLay: (runnerName: string, offerId: number) => void;
  onTrack: () => void;
}

type StepId = "pick" | "back" | "lay" | "log";

/** Matches Recommended / Qualifies guidance panels. */
const workflowPanel = "rounded-md border border-border/70";
const workflowPanelPad = "px-2.5 py-2";

function StepRow({
  done,
  active,
  label,
  detail,
  action,
}: {
  done: boolean;
  active: boolean;
  label: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-2.5 py-2 text-xs",
        done && "opacity-80"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          done
            ? "border-success/40 bg-success/15 text-success"
            : active
              ? "border-foreground/30 bg-card text-foreground"
              : "border-border text-muted-foreground"
        )}
      >
        {done ? <Check className="size-2.5" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "line-through decoration-muted-foreground/50")}>
          {label}
        </p>
        {detail != null && detail !== "" && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function namesMatch(a: string, b: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = n(a);
  const nb = n(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function PlayGuidance({
  edge,
  heuristicName,
  dataSource,
}: {
  edge: OfferEdgePlay | undefined;
  heuristicName?: string;
  dataSource?: RacingOfferGuideProps["dataSource"];
}) {
  if (edge) {
    return (
      <div className={cn(workflowPanelPad, "rounded-md border border-edge/25")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-edge">
            <Sparkles className="size-3" aria-hidden />
            Recommended
          </span>
          <OfferConfidenceBadge
            confidence={edge.confidence}
            dataSource={dataSource}
          />
          <span className="ml-auto inline-flex items-baseline gap-1 text-sm">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">EV</span>
            <MoneyFlow value={edge.totalEv} signColor signDisplay className="font-semibold" />
          </span>
        </div>
        <p className="mt-1 text-xs">
          Back <span className="font-semibold">{edge.runner.name}</span>
          <span className="text-muted-foreground">
            {" "}
            at {formatDecimalOdds(edge.runner.backDecimal)}
          </span>
        </p>
        {edge.reasons.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {edge.reasons.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {edge.warnings.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {edge.warnings.slice(0, 2).map((warning) => (
              <p key={warning} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <AlertTriangle className="mt-px size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (heuristicName) {
    return (
      <div className={cn(workflowPanel, workflowPanelPad)}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Estimate
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Qualifies, but no modelled Edge play yet. Heuristic pick:{" "}
          <span className="font-medium text-foreground">{heuristicName}</span>. Prefer Race picks
          when available.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(workflowPanel, workflowPanelPad)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Qualifies
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        No strong play modelled for this race. Pick a runner from the card only if you have a reason
        beyond the offer rules.
      </p>
    </div>
  );
}

function OfferWorkflowBody({
  race,
  offerTag,
  edge,
  dataSource,
  onBack,
  onLay,
  onTrack,
}: {
  race: RacingDeskRace;
  offerTag: RaceOfferTag;
  edge?: OfferEdgePlay;
  dataSource?: RacingOfferGuideProps["dataSource"];
  onBack: (runnerName: string, offerId: number) => void;
  onLay: (runnerName: string, offerId: number) => void;
  onTrack: () => void;
}) {
  const { state } = useAppState();
  const [backDone, setBackDone] = useState(false);
  const [layDone, setLayDone] = useState(false);

  // Adjust-during-render: switching offers resets the step progress.
  const [prevOfferId, setPrevOfferId] = useState(offerTag.offerId);
  if (prevOfferId !== offerTag.offerId) {
    setPrevOfferId(offerTag.offerId);
    setBackDone(false);
    setLayDone(false);
  }

  const heuristicRunner =
    offerTag.suggestedRunners?.[0]?.name ??
    race.runners.find((r) => (r.offerTargetScore ?? 0) >= 35)?.name;

  const targetRunner =
    edge?.runner.name ??
    heuristicRunner ??
    race.runners.find((r) => !r.nonRunner)?.name;

  const linkedBackBet = useMemo(() => {
    if (race.trackedEventId == null) return null;
    const bets = state?.bets ?? [];
    return (
      bets.find(
        (b) =>
          b.status === "open" &&
          b.eventId === race.trackedEventId &&
          b.offerId === offerTag.offerId &&
          (b.betType === "qualifying" || b.betType === "risk_free") &&
          b.selection?.trim()
      ) ??
      bets.find(
        (b) =>
          b.status === "open" &&
          b.eventId === race.trackedEventId &&
          (b.betType === "qualifying" || b.betType === "risk_free") &&
          b.selection?.trim()
      ) ??
      null
    );
  }, [state?.bets, race.trackedEventId, offerTag.offerId]);

  const actualSelection = linkedBackBet?.selection?.trim() || null;
  const usedDifferentHorse =
    !!actualSelection &&
    !!targetRunner &&
    !namesMatch(actualSelection, targetRunner);

  const tracked = race.trackedEventId != null;
  const hasOpenBet = race.openBetCount > 0 || linkedBackBet != null;
  const logged = tracked || hasOpenBet;
  const hasLayStake = (linkedBackBet?.layStake ?? 0) > 0;
  const layStepDone = layDone || hasLayStake;

  const steps: Array<{ id: StepId; done: boolean; active: boolean }> = [
    { id: "pick", done: true, active: false },
    {
      id: "back",
      done: backDone || hasOpenBet,
      active: !backDone && !hasOpenBet,
    },
    { id: "lay", done: layStepDone, active: (backDone || hasOpenBet) && !layStepDone },
    {
      id: "log",
      done: logged,
      active: (backDone || hasOpenBet) && !logged,
    },
  ];

  const nextStep = steps.find((s) => !s.done)?.id ?? "log";
  const stakeLabel = offerTag.betStake ?? linkedBackBet?.backStake ?? "-";
  const backPriceLabel =
    edge != null ? ` at ${formatDecimalOdds(edge.runner.backDecimal)}` : "";

  const backDetail = (() => {
    if (usedDifferentHorse && actualSelection && targetRunner) {
      return (
        <>
          Back{" "}
          <span className="line-through decoration-muted-foreground/70">{targetRunner}</span>{" "}
          <span className="font-semibold text-foreground">{actualSelection}</span>
          {" "}
          @ £{stakeLabel} stake
          {edge != null && (
            <span className="ml-1.5 inline-flex align-middle">
              <MoneyFlow value={edge.totalEv} signColor signDisplay className="text-[11px]" />
              <span className="ml-1 text-[10px] text-muted-foreground">EV</span>
            </span>
          )}
        </>
      );
    }
    if (actualSelection) {
      return `Back ${actualSelection} @ £${stakeLabel} stake`;
    }
    if (targetRunner) {
      return (
        <>
          Back {targetRunner}
          {backPriceLabel} @ £{offerTag.betStake ?? "-"} stake
          {edge != null && (
            <span className="ml-1.5 inline-flex items-baseline gap-1 align-middle">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">EV</span>
              <MoneyFlow value={edge.totalEv} signColor signDisplay className="text-[11px] font-medium" />
            </span>
          )}
        </>
      );
    }
    return "Choose a runner from the card";
  })();

  const layTarget = actualSelection || targetRunner;

  return (
    <div className="space-y-2 px-3 py-3">
      <PlayGuidance edge={edge} heuristicName={heuristicRunner} dataSource={dataSource} />
      <ol className="space-y-2">
        <li className={workflowPanel}>
          <StepRow
            done
            active={nextStep === "pick"}
            label="Race qualifies"
            detail={`${race.course} ${race.startTime ? formatClockTime(race.startTime) : race.offTime} - eligible for ${offerTag.bookmaker ?? "your offer"}`}
          />
        </li>
        <li className={cn(workflowPanel, "overflow-hidden")}>
          <div className="divide-y divide-border/70">
            <StepRow
              done={steps[1].done}
              active={nextStep === "back"}
              label="Back (qualifying bet)"
              detail={backDetail}
              action={
                targetRunner && !steps[1].done ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      onBack(targetRunner, offerTag.offerId);
                      setBackDone(true);
                    }}
                  >
                    <Gift className="size-3" />
                    Back
                  </Button>
                ) : null
              }
            />
            <StepRow
              done={steps[2].done}
              active={nextStep === "lay"}
              label="Lay (matched calc)"
              detail={
                usedDifferentHorse && actualSelection
                  ? `Open matched calculator for ${actualSelection}`
                  : layTarget
                    ? `Open matched calculator for ${layTarget}`
                    : "Open matched calculator with prefilled odds"
              }
              action={
                layTarget && !steps[2].done ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={() => {
                      onLay(layTarget, offerTag.offerId);
                      setLayDone(true);
                    }}
                  >
                    <Calculator className="size-3" />
                    Lay
                  </Button>
                ) : null
              }
            />
          </div>
        </li>
        <li className={workflowPanel}>
          <StepRow
            done={steps[3].done}
            active={nextStep === "log"}
            label="Log in tracker"
            detail={tracked ? "Race tracked - bets linked" : "Track race so results settle your bets"}
            action={
              !tracked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={onTrack}
                >
                  <Pin className="size-3" />
                  Track
                </Button>
              ) : (
                <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" asChild>
                  <Link href="/tracker?queue=offers">
                    <NotebookPen className="size-3" />
                    Tracker
                  </Link>
                </Button>
              )
            }
          />
        </li>
      </ol>
    </div>
  );
}

function CompactOfferCard({
  tag,
  edge,
  isBest,
  selected,
  onSelect,
}: {
  tag: RaceOfferTag;
  edge?: OfferEdgePlay;
  isBest: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const ev = offerTagDisplayEv(tag, edge);
  const hasEv = Number.isFinite(ev);
  const pickName = edge?.runner.name ?? tag.suggestedRunners?.[0]?.name;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-[11.5rem] shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? edge
            ? "border-edge/45 bg-edge/10 ring-1 ring-edge/30"
            : "border-success/45 bg-success/10 ring-1 ring-success/30"
          : "border-border/70 bg-card hover:border-foreground/25 hover:bg-selection-subtle"
      )}
    >
      <div className="flex items-center gap-1">
        {isBest ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide",
              edge
                ? "bg-edge/15 text-edge"
                : "bg-success/15 text-success"
            )}
          >
            <Sparkles className="size-2.5" />
            Best
          </span>
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Offer
          </span>
        )}
        {hasEv ? (
          <span className="ml-auto text-[10px] font-semibold tabular-nums">
            <MoneyFlow value={ev} signColor signDisplay />
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">
        {tag.offerTitle}
      </p>
      <div className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground">
        {tag.bookmaker ? <VenueBadge name={tag.bookmaker} /> : <span>Any bookie</span>}
        {tag.betStake != null && tag.freeBetAmount != null ? (
          <span className="truncate">
            · £{tag.betStake}/£{tag.freeBetAmount}
          </span>
        ) : null}
      </div>
      {pickName ? (
        <p className="truncate text-[10px] text-muted-foreground">
          {edge ? "Recommended" : "Pick"}{" "}
          <span className="font-medium text-foreground">{pickName}</span>
        </p>
      ) : null}
    </button>
  );
}

/**
 * Horizontal offer strip: every qualifying offer is visible.
 * Best-value offer is expanded with the full workflow; others sit as compact cards
 * (scroll sideways) and expand when selected.
 *
 * Runner + EV prefer Offer Edge (same engine as Race picks). Heuristic suggested
 * runners are fallback only, labelled as estimates.
 */
export function RacingOfferGuide({
  race,
  edgePlays = [],
  dataSource,
  onBack,
  onLay,
  onTrack,
}: RacingOfferGuideProps) {
  const tags = useMemo(() => qualifyingOfferTags(race, edgePlays), [race, edgePlays]);
  const bestId = tags[0]?.offerId ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(bestId);
  const [workflowOpen, setWorkflowOpen] = useState(true);

  // Adjust-during-render: a new race (or new best) re-selects the best offer.
  const [prevRaceKey, setPrevRaceKey] = useState({ race: race.externalId, bestId });
  if (prevRaceKey.race !== race.externalId || prevRaceKey.bestId !== bestId) {
    setPrevRaceKey({ race: race.externalId, bestId });
    setSelectedId(bestId);
    setWorkflowOpen(true);
  }

  const activeId = selectedId ?? bestId;
  const offerTag = findOfferTag(race, activeId, edgePlays);
  const edge = offerTag
    ? edgePlayForRaceOffer(edgePlays, race.externalId, offerTag.offerId)
    : undefined;

  if (tags.length === 0 || !offerTag) return null;

  const multi = tags.length > 1;
  const bestHasEdge = bestId != null
    ? edgePlayForRaceOffer(edgePlays, race.externalId, bestId) != null
    : false;

  return (
    <div className="mt-2 space-y-2">
      {multi ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tags.length} qualifying offers
            </p>
            <p className="text-[10px] text-muted-foreground">Scroll for more · tap to expand</p>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {tags.map((tag) => (
              <CompactOfferCard
                key={tag.offerId}
                tag={tag}
                edge={edgePlayForRaceOffer(edgePlays, race.externalId, tag.offerId)}
                isBest={tag.offerId === bestId}
                selected={tag.offerId === activeId}
                onSelect={() => {
                  setSelectedId(tag.offerId);
                  setWorkflowOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-md border",
          edge
            ? "border-edge/25 bg-edge/5"
            : "border-success/25 bg-success/5"
        )}
      >
        <button
          type="button"
          onClick={() => setWorkflowOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
              edge
                ? "text-edge"
                : "text-success"
            )}
          >
            <ListChecks className="size-3.5 shrink-0" />
            Offer workflow
            <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-normal normal-case text-muted-foreground">
              <span className="truncate">· {offerTag.offerTitle}</span>
              {offerTag.bookmaker ? <VenueBadge name={offerTag.bookmaker} /> : null}
            </span>
            {offerTag.offerId === bestId && multi ? (
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[9px] font-bold normal-case tracking-wide",
                  bestHasEdge ? "bg-edge/20 text-edge" : "bg-success/20 text-success"
                )}
              >
                Best value
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              workflowOpen && "rotate-180"
            )}
          />
        </button>

        {workflowOpen ? (
          <div
            className={cn(
              "border-t",
              edge ? "border-edge/15" : "border-success/15"
            )}
          >
            <OfferWorkflowBody
              race={race}
              offerTag={offerTag}
              edge={edge}
              dataSource={dataSource}
              onBack={onBack}
              onLay={onLay}
              onTrack={onTrack}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
