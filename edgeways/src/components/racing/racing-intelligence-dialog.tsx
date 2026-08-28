"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import { OfferConfidenceBadge } from "@/components/offers/offer-confidence-badge";
import { VenueBadge } from "@/components/venue-badge";
import {
  formatConfidenceLabel,
  type OfferConfidence,
} from "@/lib/offers/place-refund-ev";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { formatClockTime } from "@/lib/time-format";
import type { SuggestedRace, SuggestedRunner } from "@/lib/racing-desk/types";
import { RegionFlag } from "@/components/region-flag";
import { EmptyState } from "@/components/help/empty-state";
import { FilterPill } from "@/components/ui/filter-pill";
import {
  captionHeading,
  demoDataTag,
  dialogTicketSurface,
  dialogTitleIcon,
  filterPillCountState,
  filterPillGroup,
  listRowInteractive,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gift,
  Settings2,
  Zap,
} from "lucide-react";

export interface RacingIntelligenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SuggestedRace[];
  onSelectRace: (externalId: string) => void;
  onBackRunner: (raceId: string, runnerName: string, offerId: number) => void;
  /** Open the full campaign card for this offer (stacked over Race picks). */
  onViewOffer: (offerId: number) => void;
  dateLabel: string;
  dataSource?: "demo" | "racing-api" | "error";
  /** True when Racing Desk already has a place-refund campaign for this day. */
  hasPlaceRefundOffer?: boolean;
}

interface OfferOption {
  id: number;
  title: string;
  bookmaker: string | null;
  pickCount: number;
  bestEv: number | null;
}

type ConfidenceFilter = "all" | OfferConfidence;

function EvLine({ runner }: { runner: SuggestedRunner }) {
  if (runner.totalEv == null) return null;
  return <EvFigure value={runner.totalEv} />;
}

function EvFigure({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1",
        strong ? "text-sm font-semibold" : "text-xs"
      )}
    >
      <span className="uppercase tracking-wide text-muted-foreground">EV</span>
      <MoneyFlow value={value} signColor signDisplay estimate />
    </span>
  );
}

function MetaFigure({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      <MoneyFlow value={value} signColor signDisplay estimate />
    </span>
  );
}

function WarningLines({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="mt-px size-3 shrink-0 text-muted-foreground" aria-hidden />
          <span>{warning}</span>
        </p>
      ))}
    </div>
  );
}

function SuggestionRow({
  suggestion,
  rank,
  expanded,
  dataSource,
  onToggle,
  onSelectRace,
  onBackRunner,
}: {
  suggestion: SuggestedRace;
  rank: number;
  expanded: boolean;
  dataSource?: RacingIntelligenceDialogProps["dataSource"];
  onToggle: () => void;
  onSelectRace: (id: string) => void;
  onBackRunner: (raceId: string, runner: string, offerId: number) => void;
}) {
  const edge = suggestion.edge;
  const top = suggestion.topTarget ?? suggestion.suggestedRunners?.[0];
  const runnerName = edge?.runner.name ?? top?.name;
  const runnerPrice = edge?.runner.backDecimal ?? top?.bookieDecimal;
  const reasons = edge?.reasons ?? [];
  const leadHorseId = edge?.runner.horseId ?? top?.horseId;
  const altTargets = (suggestion.suggestedRunners ?? []).filter(
    (runner) => runner.horseId !== leadHorseId
  );
  const targetsId = `${suggestion.externalId}-${suggestion.offerId}-targets`;

  return (
    <li>
      <div className={dialogTicketSurface}>
        <button
          type="button"
          onClick={() => onSelectRace(suggestion.externalId)}
          className={cn(
            "group w-full px-4 py-3 text-left",
            listRowInteractive,
            "rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          )}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-page text-xs font-bold tabular-nums text-muted-foreground">
              {rank}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatClockTime(suggestion.startTime)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <RegionFlag code={suggestion.region} />
                  {suggestion.course}
                </span>
                <OfferConfidenceBadge
                  confidence={suggestion.confidence}
                  oddsSource={suggestion.oddsSource}
                  exchangeSource={suggestion.exchangeSource}
                  dataSource={dataSource}
                />
                {suggestion.topEv != null && (
                  <span className="sm:ml-auto">
                    <EvFigure value={suggestion.topEv} strong />
                  </span>
                )}
              </div>

              {runnerName && (
                <p className="mt-1.5 text-sm">
                  Back <span className="font-semibold">{runnerName}</span>
                  {runnerPrice != null && (
                    <span className="ml-1 text-muted-foreground">
                      at {formatDecimalOdds(runnerPrice)}
                    </span>
                  )}
                  {!edge && top && (
                    <span className="ml-2 inline-flex align-middle">
                      <EvLine runner={top} />
                    </span>
                  )}
                </p>
              )}

              {!runnerName && !edge && (
                <p className="mt-1.5 text-xs text-muted-foreground">{suggestion.summary}</p>
              )}

              {reasons.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {reasons.map((reason) => (
                    <li key={reason} className="max-w-full">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}

              {edge && <WarningLines warnings={edge.warnings} />}

              {edge ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-border/50 pt-2 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    Lay{" "}
                    <span className="text-foreground">
                      {formatDecimalOdds(edge.runner.layDecimal)}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {edge.fieldSize} runners
                  </span>
                  <MetaFigure label="Qual" value={edge.qualLoss} />
                  <MetaFigure label="FB EV" value={edge.freeBetEv} />
                </div>
              ) : suggestion.raceName ? (
                <p className="mt-1.5 min-w-0 text-pretty break-words text-xs text-muted-foreground">
                  {suggestion.raceName}
                </p>
              ) : null}
            </div>

            <ChevronRight
              className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-4 py-2">
          {runnerName ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => onBackRunner(suggestion.externalId, runnerName, suggestion.offerId)}
            >
              <Gift className="size-3.5 text-profit" />
              Back {runnerName}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => onSelectRace(suggestion.externalId)}
          >
            Open race
          </Button>
          {altTargets.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-controls={targetsId}
              className="ml-auto h-8 gap-1 text-xs text-muted-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 motion-safe:transition-transform",
                  expanded && "rotate-180"
                )}
                aria-hidden
              />
              {expanded ? "Hide" : "Show"} targets ({altTargets.length})
            </Button>
          )}
        </div>

        {expanded && altTargets.length > 0 ? (
          <div id={targetsId}>
            {altTargets.map((runner) => (
              <div
                key={runner.horseId}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-selection-subtle/40 px-4 py-2.5"
              >
                <div className="min-w-0 text-xs">
                  <span className="font-semibold">{runner.name}</span>
                  <span className="ml-2 text-muted-foreground">#{runner.marketRank}</span>
                  <span className="ml-2 inline-flex align-middle">
                    <OfferConfidenceBadge
                      confidence={runner.confidence}
                      oddsSource={runner.oddsSource}
                      exchangeSource={runner.exchangeSource}
                      dataSource={dataSource}
                    />
                  </span>
                  <p className="mt-0.5 min-w-0 text-pretty break-words text-xs text-muted-foreground">
                    {runner.summary}
                  </p>
                  {runner.qualLoss != null && (
                    <p className="mt-1 inline-flex flex-wrap items-baseline gap-x-3 text-xs">
                      <MetaFigure label="Qual" value={runner.qualLoss} />
                      {runner.freeBetEv != null && (
                        <MetaFigure label="FB EV" value={runner.freeBetEv} />
                      )}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <EvLine runner={runner} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2"
                    onClick={() =>
                      onBackRunner(suggestion.externalId, runner.name, suggestion.offerId)
                    }
                  >
                    <Gift className="size-3 text-profit" />
                    Back
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// Filter pills name the confidence bucket; row badges name the specific
// provenance (e.g. "One side live" filters "Live lay only" / "Live back only").
const CONFIDENCE_FILTERS: Array<{ id: ConfidenceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: formatConfidenceLabel("live") },
  { id: "mixed", label: formatConfidenceLabel("mixed") },
  { id: "estimate", label: formatConfidenceLabel("estimate") },
];

function bestOfferId(offers: OfferOption[]): number | null {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => {
    const evA = a.bestEv ?? Number.NEGATIVE_INFINITY;
    const evB = b.bestEv ?? Number.NEGATIVE_INFINITY;
    if (evA !== evB) return evB - evA;
    return b.pickCount - a.pickCount;
  })[0]!.id;
}

function bookieKey(bookmaker: string | null | undefined): string {
  return (bookmaker?.trim() ?? "").toLowerCase();
}

/** Bookie when unique; bookie + title when the same bookie has multiple campaigns. */
function offerSwitcherLabel(offer: OfferOption, offers: OfferOption[]): string {
  const bookie = offer.bookmaker?.trim();
  if (!bookie) return offer.title;
  const sameBookie = offers.filter((o) => bookieKey(o.bookmaker) === bookieKey(bookie));
  if (sameBookie.length <= 1) return bookie;
  return `${bookie} · ${offer.title}`;
}

function offerSwitcherNeedsTruncate(offer: OfferOption, offers: OfferOption[]): boolean {
  const bookie = offer.bookmaker?.trim();
  if (!bookie) return offer.title.length > 18;
  return (
    offers.filter((o) => bookieKey(o.bookmaker) === bookieKey(bookie)).length > 1
  );
}

function offerSwitcherAriaLabel(offer: OfferOption): string {
  return offer.bookmaker
    ? `${offer.bookmaker}: ${offer.title}`
    : offer.title;
}

export function RacingIntelligenceDialog({
  open,
  onOpenChange,
  suggestions,
  onSelectRace,
  onBackRunner,
  onViewOffer,
  dateLabel,
  dataSource,
  hasPlaceRefundOffer = false,
}: RacingIntelligenceDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);

  // Picks are always scoped to one offer. The same race can be the best play for
  // one campaign and useless for another, so there is no mixed "All offers" list.
  const offerOptions = useMemo(() => {
    const byId = new Map<number, OfferOption>();
    for (const s of suggestions) {
      const existing = byId.get(s.offerId);
      if (!existing) {
        byId.set(s.offerId, {
          id: s.offerId,
          title: s.offerTitle,
          bookmaker: s.bookmaker,
          pickCount: 1,
          bestEv: s.topEv ?? null,
        });
        continue;
      }
      existing.pickCount += 1;
      if (s.topEv != null && (existing.bestEv == null || s.topEv > existing.bestEv)) {
        existing.bestEv = s.topEv;
      }
      if (!existing.bookmaker && s.bookmaker) existing.bookmaker = s.bookmaker;
    }
    return [...byId.values()];
  }, [suggestions]);

  // When the dialog opens, land on the offer with the strongest pick. Soft polls
  // must not yank the user onto a different campaign mid-browse.
  // Adjust-during-render (react-hooks/set-state-in-effect): reset on open only.
  const [prevIntelOpen, setPrevIntelOpen] = useState(false);
  if (open !== prevIntelOpen) {
    setPrevIntelOpen(open);
    if (open) {
      setSelectedOfferId(bestOfferId(offerOptions));
      setConfidenceFilter("all");
      setExpandedId(null);
    }
  }

  // Keep the selection valid if the suggestion set shrinks while open.
  // Adjust-during-render: the condition itself prevents re-firing.
  if (
    open &&
    selectedOfferId != null &&
    !offerOptions.some((o) => o.id === selectedOfferId)
  ) {
    setSelectedOfferId(bestOfferId(offerOptions));
  }

  // Before the open-effect lands, fall back to the strongest offer so the header
  // never flashes empty on the first paint.
  const activeOfferId = selectedOfferId ?? bestOfferId(offerOptions);
  const activeOffer = offerOptions.find((o) => o.id === activeOfferId) ?? null;

  const scoped = useMemo(
    () =>
      activeOfferId == null
        ? []
        : suggestions.filter((s) => s.offerId === activeOfferId),
    [suggestions, activeOfferId]
  );

  const sorted = useMemo(() => {
    // Modelled plays lead, then by expected value. `score` is only a last-resort
    // tiebreak for races the model could not price.
    const list = [...scoped].sort((a, b) => {
      if (!!a.edge !== !!b.edge) return a.edge ? -1 : 1;
      const evA = a.topEv ?? Number.NEGATIVE_INFINITY;
      const evB = b.topEv ?? Number.NEGATIVE_INFINITY;
      if (evA !== evB) return evB - evA;
      return b.score - a.score;
    });
    if (confidenceFilter === "all") return list;
    return list.filter((s) => s.confidence === confidenceFilter);
  }, [scoped, confidenceFilter]);

  const tierCounts = useMemo(() => {
    const counts: Record<ConfidenceFilter, number> = {
      all: scoped.length,
      live: 0,
      mixed: 0,
      estimate: 0,
    };
    for (const s of scoped) {
      if (s.confidence) counts[s.confidence] += 1;
    }
    return counts;
  }, [scoped]);

  function selectOffer(id: number) {
    setSelectedOfferId(id);
    setConfidenceFilter("all");
    setExpandedId(null);
  }

  function pickRace(externalId: string) {
    onSelectRace(externalId);
    onOpenChange(false);
  }

  function backRunner(raceId: string, runner: string, offerId: number) {
    onBackRunner(raceId, runner, offerId);
    onOpenChange(false);
  }

  // Bookie-only pills stay short; keep the dropdown threshold higher than when
  // tabs carried the full offer title.
  const useDropdown = offerOptions.length > 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-dialog-tone="page"
        className="flex max-h-[min(90vh,840px)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-4xl dark:bg-page"
      >
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <Zap className={cn(dialogTitleIcon, "text-edge")} aria-hidden />
            Race picks
            {dataSource === "demo" ? (
              <span className={demoDataTag}>Demo data</span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Ranked picks for {dateLabel}.
          </DialogDescription>
        </DialogHeader>

        {(offerOptions.length > 1 || activeOffer || scoped.length > 0) && (
          <div className="shrink-0 border-b border-border/50">
          {offerOptions.length > 1 && (
            <div className="px-6 py-3">
              {useDropdown ? (
                <Select
                  value={activeOfferId != null ? String(activeOfferId) : undefined}
                  onValueChange={(value) => selectOffer(Number(value))}
                >
                  <SelectTrigger className="h-9 w-full bg-card text-left text-xs">
                    <SelectValue placeholder="Choose a bookie" />
                  </SelectTrigger>
                  <SelectContent>
                    {offerOptions.map((offer) => {
                      const label = offerSwitcherLabel(offer, offerOptions);
                      return (
                        <SelectItem
                          key={offer.id}
                          value={String(offer.id)}
                          title={offerSwitcherAriaLabel(offer)}
                          className="max-w-[min(100vw-2rem,28rem)]"
                        >
                          <span className="truncate">
                            {label}
                            {` · ${offer.pickCount}`}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className={filterPillGroup}>
                  {offerOptions.map((offer) => {
                    const active = activeOfferId === offer.id;
                    const label = offerSwitcherLabel(offer, offerOptions);
                    const aria = offerSwitcherAriaLabel(offer);
                    const truncate = offerSwitcherNeedsTruncate(
                      offer,
                      offerOptions
                    );
                    return (
                      <FilterPill
                        key={offer.id}
                        tone="edge"
                        active={active}
                        onClick={() => selectOffer(offer.id)}
                        hasCount
                        className={cn("text-xs", truncate && "max-w-[14rem]")}
                        title={aria}
                        aria-label={`${aria}, ${offer.pickCount} picks`}
                      >
                        <span className="truncate">{label}</span>
                        <span className={filterPillCountState(active)}>
                          {offer.pickCount}
                        </span>
                      </FilterPill>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeOffer && (
            <div
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-6 py-3",
                offerOptions.length > 1 && "border-t border-border/50"
              )}
            >
              <div className="min-w-0 flex-1">
                {activeOffer.bookmaker ? (
                  <VenueBadge name={activeOffer.bookmaker} kind="bookie" size="md" />
                ) : (
                  <span className={captionHeading}>Offer</span>
                )}
                <p className="mt-1.5 text-sm font-semibold leading-snug">
                  {activeOffer.title}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => onViewOffer(activeOffer.id)}
              >
                <ExternalLink className="size-3.5" />
                View offer
              </Button>
            </div>
          )}

          {scoped.length > 0 && (
            <div className={cn(filterPillGroup, "px-6 py-3")}>
              {CONFIDENCE_FILTERS.map((f) => {
                const count = tierCounts[f.id];
                if (f.id !== "all" && count === 0) return null;
                const active = confidenceFilter === f.id;
                return (
                  <FilterPill
                    key={f.id}
                    active={active}
                    onClick={() => setConfidenceFilter(f.id)}
                    hasCount
                    className="text-xs"
                  >
                    {f.label}
                    <span className={filterPillCountState(active)}>{count}</span>
                  </FilterPill>
                );
              })}
            </div>
          )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {sorted.length === 0 ? (
            <EmptyState
              compact
              oneLine
              icon={Zap}
              title={suggestions.length === 0 ? "No picks yet" : "No picks in this tier"}
              description={
                suggestions.length === 0
                  ? hasPlaceRefundOffer
                    ? "Qualifying races need bookie or live lay prices before they can be ranked. Paste a price, or wait for the exchange to match."
                    : "Add a place-refund offer to unlock ranked picks."
                  : "Try another confidence filter."
              }
            />
          ) : (
            <ul className="space-y-3">
              {sorted.map((s, idx) => (
                <SuggestionRow
                  key={`${s.externalId}-${s.offerId}`}
                  suggestion={s}
                  rank={idx + 1}
                  expanded={expandedId === `${s.externalId}-${s.offerId}`}
                  dataSource={dataSource}
                  onToggle={() =>
                    setExpandedId((prev) =>
                      prev === `${s.externalId}-${s.offerId}`
                        ? null
                        : `${s.externalId}-${s.offerId}`
                    )
                  }
                  onSelectRace={pickRace}
                  onBackRunner={backRunner}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RacingIntelligenceTrigger({
  count,
  topEv,
  onClick,
  demo = false,
}: {
  count: number;
  /** Best expected value across the picks, in pounds. */
  topEv?: number;
  onClick: () => void;
  demo?: boolean;
}) {
  const showEv = count > 0 && topEv != null && topEv > 0;
  return (
    <Button
      type="button"
      variant="outline"
      {...pageSecondaryButtonProps}
      size="lg"
      className="gap-2"
      onClick={onClick}
    >
      <Zap className="size-4 text-edge" aria-hidden />
      Race picks
      {demo ? <span className={demoDataTag}>Demo data</span> : null}
      {showEv && (
        <span
          className={cn(
            "hidden text-xs font-semibold tabular-nums sm:inline",
            moneyPositiveClass
          )}
        >
          +£{topEv.toFixed(2)}
        </span>
      )}
    </Button>
  );
}

export type DeskRaceFilter = "all" | "qualifying" | "recommended";

export function DeskFilterPills({
  filter,
  onFilterChange,
  onSettingsClick,
  qualifyingCount = 0,
  racePicksCount = 0,
  /** Inside a parent card — no own plate; use a light bottom rule. */
  embedded = false,
  /** Edge-only. Core / Free hide the Race picks pill. */
  showRacePicks = true,
}: {
  filter: DeskRaceFilter;
  onFilterChange: (v: DeskRaceFilter) => void;
  onSettingsClick: () => void;
  /** Races that qualify for at least one active offer (All-races universe). */
  qualifyingCount?: number;
  /** Races with at least one Offer Edge play (All-races universe). */
  racePicksCount?: number;
  embedded?: boolean;
  showRacePicks?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-3",
        // py-2 (8px) + 4px → 12px vertical
        embedded
          ? // Keep the tighter inset — do not follow desk --card-spacing (+4px).
            "border-b border-border/60 px-3 py-3"
          : "rounded-lg bg-muted/50 px-3 py-3 ring-1 ring-border/45"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill active={filter === "all"} onClick={() => onFilterChange("all")}>
          All races
        </FilterPill>
        <FilterPill
          active={filter === "qualifying"}
          onClick={() => onFilterChange("qualifying")}
          hasCount
        >
          Qualifying
          <span className={filterPillCountState(filter === "qualifying")}>
            {qualifyingCount}
          </span>
        </FilterPill>
        {showRacePicks ? (
          <FilterPill
            tone="edge"
            active={filter === "recommended"}
            onClick={() => onFilterChange("recommended")}
            hasCount
          >
            <Zap
              className={cn("size-3", filter !== "recommended" && "text-edge")}
              aria-hidden
            />
            Race picks
            <span className={filterPillCountState(filter === "recommended")}>
              {racePicksCount}
            </span>
          </FilterPill>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onSettingsClick}
        aria-label="Settings"
        title="Settings"
      >
        <Settings2 className="size-4" />
      </Button>
    </div>
  );
}
