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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Switch } from "@/components/ui/switch";
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
import { FilterPill } from "@/components/ui/filter-pill";
import {
  edgeNavTag,
  filterPillCountState,
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
    <span className={cn("inline-flex items-baseline gap-1", strong ? "text-sm" : "text-xs")}>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">EV</span>
      <MoneyFlow value={value} signColor signDisplay className={cn(strong && "font-semibold")} />
    </span>
  );
}

function WarningLines({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
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
  advanced,
  expanded,
  dataSource,
  onToggle,
  onSelectRace,
  onBackRunner,
}: {
  suggestion: SuggestedRace;
  rank: number;
  advanced: boolean;
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

  return (
    <li>
      <div className="rounded-lg border border-border/60 bg-card">
        <button
          type="button"
          onClick={() => onSelectRace(suggestion.externalId)}
          className={cn(
            "group w-full rounded-lg px-4 py-3 text-left",
            listRowInteractive
          )}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums text-muted-foreground">
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
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {reasons.map((reason) => (
                    <li key={reason} className="max-w-full">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}

              {edge && <WarningLines warnings={edge.warnings} />}

              {advanced && (
                <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                  <p className="truncate">{suggestion.raceName}</p>
                  {edge ? (
                    <p className="tabular-nums">
                      Lay {formatDecimalOdds(edge.runner.layDecimal)} · {edge.fieldSize} runners ·
                      qual £{edge.qualLoss.toFixed(2)} · FB EV £{edge.freeBetEv.toFixed(2)}
                    </p>
                  ) : (
                    <p>{suggestion.summary}</p>
                  )}
                </div>
              )}
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
              <Gift className="size-3.5 text-emerald-600" />
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
          {advanced && (suggestion.suggestedRunners?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={onToggle}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
              />
              {expanded ? "Hide" : "Show"} targets ({suggestion.suggestedRunners!.length})
            </button>
          )}
        </div>

        {advanced &&
          expanded &&
          suggestion.suggestedRunners?.map((runner) => (
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
                <p className="mt-0.5 text-[11px] text-muted-foreground">{runner.summary}</p>
                {runner.qualLoss != null && (
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    Qual £{runner.qualLoss.toFixed(2)}
                    {runner.freeBetEv != null && ` · FB EV £${runner.freeBetEv.toFixed(2)}`}
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
                  <Gift className="size-3 text-emerald-600" />
                  Back
                </Button>
              </div>
            </div>
          ))}
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

export function RacingIntelligenceDialog({
  open,
  onOpenChange,
  suggestions,
  onSelectRace,
  onBackRunner,
  onViewOffer,
  dateLabel,
  dataSource,
}: RacingIntelligenceDialogProps) {
  const [advanced, setAdvanced] = useState(false);
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

  const useDropdown = offerOptions.length > 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,840px)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 rounded-t-xl border-b bg-selection-subtle px-5 py-4 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <Zap className="size-4 text-edge" />
                Race picks
              </DialogTitle>
              <DialogDescription className="mt-1 text-[11px]">
                Edge race and horse for this offer on {dateLabel}
                {dataSource === "demo" && (
                  <span className="ml-1 text-edge"> (demo data)</span>
                )}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="intel-advanced"
                className="text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                Details
              </Label>
              <Switch
                id="intel-advanced"
                size="sm"
                checked={advanced}
                onCheckedChange={setAdvanced}
              />
            </div>
          </div>

          {offerOptions.length > 1 && (
            <div className="mt-3">
              {useDropdown ? (
                <Select
                  value={activeOfferId != null ? String(activeOfferId) : undefined}
                  onValueChange={(value) => selectOffer(Number(value))}
                >
                  <SelectTrigger className="h-9 w-full max-w-md bg-card text-left text-xs">
                    <SelectValue placeholder="Choose an offer" />
                  </SelectTrigger>
                  <SelectContent>
                    {offerOptions.map((offer) => (
                      <SelectItem key={offer.id} value={String(offer.id)}>
                        {(offer.bookmaker ? `${offer.bookmaker} · ` : "") + offer.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {offerOptions.map((offer) => {
                    const active = activeOfferId === offer.id;
                    return (
                      <FilterPill
                        key={offer.id}
                        active={active}
                        onClick={() => selectOffer(offer.id)}
                        hasCount
                        className="max-w-[260px] text-[10px]"
                        title={offer.title}
                      >
                        <span className="truncate">
                          {offer.bookmaker
                            ? `${offer.bookmaker}: ${offer.title}`
                            : offer.title}
                        </span>
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
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5">
              <div className="min-w-0 flex-1">
                {activeOffer.bookmaker ? (
                  <VenueBadge name={activeOffer.bookmaker} kind="bookie" size="md" />
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Offer
                  </span>
                )}
                <p className="mt-1.5 text-sm font-semibold leading-snug">{activeOffer.title}</p>
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
            <div className="mt-3 flex flex-wrap gap-1">
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
                    className="text-[10px]"
                  >
                    {f.label}
                    <span className={filterPillCountState(active)}>{count}</span>
                  </FilterPill>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {sorted.length === 0 ? (
            <div className="px-2 py-12 text-center text-sm text-muted-foreground">
              <Zap className="mx-auto mb-2 size-8 text-edge/40" />
              <p className="font-medium text-foreground">
                {suggestions.length === 0 ? "No picks yet" : "No picks in this tier"}
              </p>
              <p className="mt-1 text-xs">
                {suggestions.length === 0
                  ? "Add an active place-refund offer to unlock ranked picks."
                  : "Try another confidence filter. Estimated prices are still ranked by EV."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sorted.map((s, idx) => (
                <SuggestionRow
                  key={`${s.externalId}-${s.offerId}`}
                  suggestion={s}
                  rank={idx + 1}
                  advanced={advanced}
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
}: {
  count: number;
  /** Best expected value across the picks, in pounds. */
  topEv?: number;
  onClick: () => void;
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
      <Zap className="size-4 text-edge" />
      Race picks
      {showEv && (
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <span className={edgeNavTag}>Edge</span>
          <span className={cn("text-xs font-semibold tabular-nums", moneyPositiveClass)}>
            +£{topEv.toFixed(2)}
          </span>
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
}: {
  filter: DeskRaceFilter;
  onFilterChange: (v: DeskRaceFilter) => void;
  onSettingsClick: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/45">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill active={filter === "all"} onClick={() => onFilterChange("all")}>
          All races
        </FilterPill>
        <FilterPill
          active={filter === "qualifying"}
          onClick={() => onFilterChange("qualifying")}
        >
          Qualifying
        </FilterPill>
        <FilterPill
          active={filter === "recommended"}
          onClick={() => onFilterChange("recommended")}
        >
          <Zap
            className={cn("size-3", filter !== "recommended" && "text-edge")}
            aria-hidden
          />
          Edge
        </FilterPill>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={onSettingsClick}
      >
        <Settings2 className="size-3.5" />
        Settings
      </Button>
    </div>
  );
}
