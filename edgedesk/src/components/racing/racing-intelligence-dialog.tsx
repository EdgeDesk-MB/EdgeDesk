"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Switch } from "@/components/ui/switch";
import {
  formatConfidenceLabel,
  formatOddsSourceLabel,
  type OfferConfidence,
} from "@/lib/offers/place-refund-ev";
import { formatDecimalOdds } from "@/lib/racing/odds";
import type { SuggestedRace, SuggestedRunner } from "@/lib/racing-desk/types";
import { RegionFlag } from "@/components/region-flag";
import { filterPillState, listRowInteractive } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ChevronDown, Gift, Sparkles } from "lucide-react";

export interface RacingIntelligenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SuggestedRace[];
  onSelectRace: (externalId: string) => void;
  onBackRunner: (raceId: string, runnerName: string, offerId: number) => void;
  dateLabel: string;
  dataSource?: "demo" | "racing-api" | "error";
}

type ConfidenceFilter = "all" | OfferConfidence;

function ConfidenceBadge({
  confidence,
  oddsSource,
  dataSource,
}: {
  confidence?: SuggestedRunner["confidence"];
  oddsSource?: SuggestedRace["oddsSource"];
  dataSource?: RacingIntelligenceDialogProps["dataSource"];
}) {
  if (dataSource === "demo") {
    return (
      <Badge variant="outline" className="border-violet-500/40 text-[9px] uppercase text-violet-700 dark:text-violet-300">
        Demo
      </Badge>
    );
  }

  const label = confidence ? formatConfidenceLabel(confidence) : formatOddsSourceLabel(oddsSource, dataSource);
  const variant =
    confidence === "live" || oddsSource === "live"
      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      : confidence === "mixed"
        ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
        : oddsSource === "proxy"
          ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
          : "border-border text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("text-[9px] uppercase", variant)}>
      {label}
    </Badge>
  );
}

function EvLine({ runner }: { runner: SuggestedRunner }) {
  if (runner.totalEv == null) return null;
  const positive = runner.totalEv > 0;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        positive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      )}
    >
      EV {positive ? "+" : ""}£{runner.totalEv.toFixed(2)}
    </span>
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
  const top = suggestion.topTarget ?? suggestion.suggestedRunners?.[0];

  return (
    <li className="border-b border-border/60 last:border-0">
      <div className="flex items-start gap-2 px-4 py-3">
        <span className="w-5 shrink-0 pt-1 text-xs font-bold tabular-nums text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelectRace(suggestion.externalId)}
            className={cn("w-full text-left", listRowInteractive, "-mx-1 rounded-md px-1 py-0.5")}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">{suggestion.offTime}</span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <RegionFlag code={suggestion.region} />
                {suggestion.course}
              </span>
              <Badge variant="secondary" className="h-5 tabular-nums">
                {suggestion.score}
              </Badge>
              <ConfidenceBadge
                confidence={suggestion.confidence}
                oddsSource={suggestion.oddsSource}
                dataSource={dataSource}
              />
            </span>
            {!advanced && top && (
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  Back <span className="font-semibold">{top.name}</span>
                  {top.bookieDecimal != null && (
                    <span className="ml-1 text-muted-foreground">
                      @ {formatDecimalOdds(top.bookieDecimal)}
                    </span>
                  )}
                </span>
                <EvLine runner={top} />
                {top.confidence && dataSource !== "demo" && (
                  <Badge variant="outline" className="h-4 text-[9px]">
                    {formatConfidenceLabel(top.confidence)}
                  </Badge>
                )}
              </span>
            )}
            {!advanced && !top && (
              <span className="mt-1 block text-xs text-muted-foreground">{suggestion.summary}</span>
            )}
          </button>

          {advanced && (
            <>
              <p className="mt-1 truncate text-xs text-muted-foreground">{suggestion.raceName}</p>
              <p className="text-[11px] text-muted-foreground">{suggestion.offerTitle}</p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{suggestion.summary}</p>
              {(suggestion.suggestedRunners?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
                  />
                  {expanded ? "Hide" : "Show"} targets ({suggestion.suggestedRunners!.length})
                </button>
              )}
              {expanded &&
                suggestion.suggestedRunners?.map((runner) => (
                  <div
                    key={runner.horseId}
                    className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-selection-subtle/50 px-2.5 py-2"
                  >
                    <div className="min-w-0 text-xs">
                      <span className="font-semibold">{runner.name}</span>
                      <span className="ml-2 text-muted-foreground">#{runner.marketRank}</span>
                      <ConfidenceBadge
                        confidence={runner.confidence}
                        oddsSource={runner.oddsSource}
                        dataSource={dataSource}
                      />
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
            </>
          )}
        </div>
        {!advanced && top && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1"
            onClick={() => onBackRunner(suggestion.externalId, top.name, suggestion.offerId)}
          >
            <Gift className="size-3 text-emerald-600" />
            Back
          </Button>
        )}
      </div>
    </li>
  );
}

const CONFIDENCE_FILTERS: Array<{ id: ConfidenceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live odds" },
  { id: "mixed", label: "Partial" },
  { id: "estimate", label: "Estimated" },
];

export function RacingIntelligenceDialog({
  open,
  onOpenChange,
  suggestions,
  onSelectRace,
  onBackRunner,
  dateLabel,
  dataSource,
}: RacingIntelligenceDialogProps) {
  const [advanced, setAdvanced] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  const sorted = useMemo(() => {
    const list = [...suggestions].sort((a, b) => {
      const evA = a.topEv ?? a.score;
      const evB = b.topEv ?? b.score;
      return evB - evA;
    });
    if (confidenceFilter === "all") return list;
    return list.filter((s) => s.confidence === confidenceFilter);
  }, [suggestions, confidenceFilter]);

  const tierCounts = useMemo(() => {
    const counts: Record<ConfidenceFilter, number> = {
      all: suggestions.length,
      live: 0,
      mixed: 0,
      estimate: 0,
    };
    for (const s of suggestions) {
      if (s.confidence) counts[s.confidence] += 1;
    }
    return counts;
  }, [suggestions]);

  function pickRace(externalId: string) {
    onSelectRace(externalId);
    onOpenChange(false);
  }

  function backRunner(raceId: string, runner: string, offerId: number) {
    onBackRunner(raceId, runner, offerId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,720px)] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-b bg-selection-subtle px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <Sparkles className="size-4 text-violet-500" />
                Race picks
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                Best qualifying races for your active offers on {dateLabel}
                {dataSource === "demo" && (
                  <span className="ml-1 text-violet-600 dark:text-violet-400">· demo data</span>
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

          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {CONFIDENCE_FILTERS.map((f) => {
                const count = tierCounts[f.id];
                if (f.id !== "all" && count === 0) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setConfidenceFilter(f.id)}
                    className={cn(filterPillState(confidenceFilter === f.id), "text-[10px]")}
                  >
                    {f.label}
                    <span className="tabular-nums text-muted-foreground">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 size-8 text-violet-500/40" />
              <p className="font-medium text-foreground">
                {suggestions.length === 0 ? "No suggestions yet" : "No picks in this tier"}
              </p>
              <p className="mt-1 text-xs">
                {suggestions.length === 0
                  ? "Add an active place-refund offer to unlock ranked picks."
                  : "Try another confidence filter - proxy estimates still rank by EV."}
              </p>
            </div>
          ) : (
            <ul>
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
  topScore,
  onClick,
}: {
  count: number;
  topScore?: number;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" {...pageSecondaryButtonProps} className="gap-1.5" onClick={onClick}>
      <Sparkles className="size-4 text-violet-500" />
      Race picks
      {count > 0 && (
        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
          {count}
        </Badge>
      )}
      {count > 0 && topScore != null && (
        <span className="hidden text-xs text-muted-foreground sm:inline">· top {topScore}</span>
      )}
    </Button>
  );
}

export function DeskFilterPills({
  qualifyingOnly,
  onQualifyingOnlyChange,
  advancedMode,
  onAdvancedModeChange,
  trailing,
}: {
  qualifyingOnly: boolean;
  onQualifyingOnlyChange: (v: boolean) => void;
  advancedMode: boolean;
  onAdvancedModeChange: (v: boolean) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/45">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onQualifyingOnlyChange(false)}
          className={filterPillState(!qualifyingOnly)}
        >
          All races
        </button>
        <button
          type="button"
          onClick={() => onQualifyingOnlyChange(true)}
          className={filterPillState(qualifyingOnly)}
        >
          Qualifying
        </button>
        {trailing}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="desk-advanced-mode" className="text-xs font-medium text-muted-foreground">
          Advanced mode
        </Label>
        <Switch
          id="desk-advanced-mode"
          size="sm"
          checked={advancedMode}
          onCheckedChange={onAdvancedModeChange}
        />
      </div>
    </div>
  );
}
