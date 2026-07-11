"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RaceOfferTag, RacingDeskRace } from "@/lib/racing-desk/types";
import { findOfferTag, offerTagBestEv, qualifyingOfferTags } from "@/lib/racing/offer-tags";
import { formatClockTime } from "@/lib/time-format";
import { VenueBadge } from "@/components/venue-badge";
import { useAppState } from "@/hooks/use-app-state";
import {
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
  onBack: (runnerName: string, offerId: number) => void;
  onLay: (runnerName: string, offerId: number) => void;
  onTrack: () => void;
}

type StepId = "pick" | "back" | "lay" | "log";

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
  detail?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        active && "bg-selection-subtle",
        done && "opacity-80"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          done
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
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
    </li>
  );
}

function namesMatch(a: string, b: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = n(a);
  const nb = n(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function OfferWorkflowBody({
  race,
  offerTag,
  onBack,
  onLay,
  onTrack,
}: {
  race: RacingDeskRace;
  offerTag: RaceOfferTag;
  onBack: (runnerName: string, offerId: number) => void;
  onLay: (runnerName: string, offerId: number) => void;
  onTrack: () => void;
}) {
  const { state } = useAppState();
  const [backDone, setBackDone] = useState(false);
  const [layDone, setLayDone] = useState(false);

  // Reset step progress when switching offers
  useEffect(() => {
    setBackDone(false);
    setLayDone(false);
  }, [offerTag.offerId]);

  const targetRunner =
    offerTag.suggestedRunners?.[0]?.name ??
    race.runners.find((r) => (r.offerTargetScore ?? 0) >= 35)?.name ??
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

  const steps: Array<{ id: StepId; done: boolean; active: boolean }> = [
    { id: "pick", done: true, active: false },
    {
      id: "back",
      done: backDone || hasOpenBet,
      active: !backDone && !hasOpenBet,
    },
    { id: "lay", done: layDone, active: (backDone || hasOpenBet) && !layDone },
    {
      id: "log",
      done: logged,
      active: (backDone || hasOpenBet) && !logged,
    },
  ];

  const nextStep = steps.find((s) => !s.done)?.id ?? "log";

  const stakeLabel = offerTag.betStake ?? linkedBackBet?.backStake ?? "-";

  const backDetail = (() => {
    if (usedDifferentHorse && actualSelection && targetRunner) {
      return (
        <>
          Back{" "}
          <span className="line-through decoration-muted-foreground/70">{targetRunner}</span>{" "}
          <span className="font-semibold text-foreground">{actualSelection}</span>
          {" "}
          @ £{stakeLabel} stake
        </>
      );
    }
    if (actualSelection) {
      return `Back ${actualSelection} @ £${stakeLabel} stake`;
    }
    if (targetRunner) {
      return `Back ${targetRunner} @ £${offerTag.betStake ?? "-"} stake`;
    }
    return "Choose a runner from the card";
  })();

  const layTarget = actualSelection || targetRunner;

  return (
    <ol className="space-y-0.5 px-1 pb-2 pt-1">
      <StepRow
        done
        active={nextStep === "pick"}
        label="Pick race"
        detail={`${race.course} ${race.startTime ? formatClockTime(race.startTime) : race.offTime} - qualifying for ${offerTag.bookmaker ?? "your offer"}`}
      />
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
    </ol>
  );
}

function CompactOfferCard({
  tag,
  isBest,
  selected,
  onSelect,
}: {
  tag: RaceOfferTag;
  isBest: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const ev = offerTagBestEv(tag);
  const hasEv = Number.isFinite(ev);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-[11.5rem] shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-emerald-500/45 bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "border-border/70 bg-card hover:border-foreground/25 hover:bg-selection-subtle"
      )}
    >
      <div className="flex items-center gap-1">
        {isBest ? (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            <Sparkles className="size-2.5" />
            Best
          </span>
        ) : (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Offer
          </span>
        )}
        {hasEv ? (
          <span className="ml-auto text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            EV £{ev.toFixed(2)}
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
      {tag.suggestedRunners?.[0] ? (
        <p className="truncate text-[10px] text-muted-foreground">
          Pick <span className="font-medium text-foreground">{tag.suggestedRunners[0].name}</span>
        </p>
      ) : null}
    </button>
  );
}

/**
 * Horizontal offer strip: every qualifying offer is visible.
 * Best-value offer is expanded with the full workflow; others sit as compact cards
 * (scroll sideways) and expand when selected.
 */
export function RacingOfferGuide({ race, onBack, onLay, onTrack }: RacingOfferGuideProps) {
  const tags = useMemo(() => qualifyingOfferTags(race), [race]);
  const bestId = tags[0]?.offerId ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(bestId);
  const [workflowOpen, setWorkflowOpen] = useState(true);

  // When race changes, re-select best offer
  useEffect(() => {
    setSelectedId(bestId);
    setWorkflowOpen(true);
  }, [race.externalId, bestId]);

  const activeId = selectedId ?? bestId;
  const offerTag = findOfferTag(race, activeId);

  if (tags.length === 0 || !offerTag) return null;

  const multi = tags.length > 1;

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

      <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5">
        <button
          type="button"
          onClick={() => setWorkflowOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <ListChecks className="size-3.5 shrink-0" />
            Offer workflow
            <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-normal normal-case text-muted-foreground">
              <span className="truncate">· {offerTag.offerTitle}</span>
              {offerTag.bookmaker ? <VenueBadge name={offerTag.bookmaker} /> : null}
            </span>
            {offerTag.offerId === bestId && multi ? (
              <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-bold normal-case tracking-wide">
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
          <div className="border-t border-emerald-500/15">
            <OfferWorkflowBody
              race={race}
              offerTag={offerTag}
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
