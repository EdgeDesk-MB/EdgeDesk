"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDecimalOdds, formatWeightStones } from "@/lib/racing/odds";
import { formatHeadgear } from "@/lib/racing/runner-display";
import type { RacingDeskRace, RacingRunnerDetail } from "@/lib/racing-desk/types";
import { PriceMovementArrow, PriceMovementBadge } from "@/components/racing/price-movement-badge";
import { RacingOfferGuide } from "@/components/racing/racing-offer-guide";
import { RunnerCloth } from "@/components/racing/runner-cloth";
import { Calculator, Gift, NotebookPen, Pin, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPillState,
  listRow,
  sectionBar,
  sectionMeta,
  sectionTitle,
} from "@/lib/ui/surface-styles";

export interface FlashscoreRacecardProps {
  courses: Array<[string, RacingDeskRace[]]>;
  selected: RacingDeskRace | null;
  selectedId: string | null;
  onSelectRace: (id: string) => void;
  bookiePlaces: number;
  exchangePlaces: number;
  onTrack: (race: RacingDeskRace) => void;
  onBet: (race: RacingDeskRace, runner: string, mode: "win" | "extra_place" | "place_refund" | "lay") => void;
  /** Show movement, spread %, expanded offer intel */
  advancedMode?: boolean;
  /** Guided place-refund workflow on qualifying races */
  showOfferGuide?: boolean;
}

function regionLabel(region?: string): string {
  if (region?.toUpperCase() === "IRE") return "IRELAND";
  return "UK";
}

function spreadTone(spreadPct?: number): string {
  if (spreadPct == null) return "text-muted-foreground";
  if (spreadPct <= 3) return "text-emerald-600 dark:text-emerald-400";
  if (spreadPct <= 8) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function RunnerRow({
  runner,
  race,
  hasPlaceOffer,
  bookiePlaces,
  exchangePlaces,
  onBet,
  advancedMode = false,
}: {
  runner: RacingRunnerDetail;
  race: RacingDeskRace;
  hasPlaceOffer: boolean;
  bookiePlaces: number;
  exchangePlaces: number;
  onBet: FlashscoreRacecardProps["onBet"];
  advancedMode: boolean;
}) {
  const isSteamer = runner.movement?.change != null && runner.movement.change < -0.05;
  const isDrifter = runner.movement?.change != null && runner.movement.change > 0.05;
  const hasSnapshots = (runner.movement?.snapshotCount ?? 0) >= 2;
  const isProxy = runner.oddsSource === "proxy";
  const isOfferTarget = (runner.offerTargetScore ?? 0) >= 35;
  const isLiveExchange = runner.exchangeSource === "live";

  return (
    <tr
      className={cn(
        listRow,
        isSteamer && "bg-emerald-500/5",
        isOfferTarget && "bg-emerald-500/8"
      )}
    >
      <td className="w-12 px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          <RunnerCloth number={runner.number} silkUrl={runner.silkUrl} size="sm" />
          {runner.draw && runner.draw !== "0" && (
            <span className="text-[10px] tabular-nums text-muted-foreground" title="Draw">
              ({runner.draw})
            </span>
          )}
        </div>
      </td>
      <td className="min-w-[10rem] px-2 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
            {race.region?.toUpperCase() === "IRE" ? "IRE" : "GB"}
          </span>
          <span className="font-semibold leading-tight">{runner.name}</span>
          {isSteamer && (
            <Badge variant="outline" className="border-emerald-500/40 text-[9px] text-emerald-600">
              steamer
            </Badge>
          )}
          {isDrifter && hasSnapshots && (
            <Badge variant="outline" className="border-red-500/40 text-[9px] text-red-600">
              drifter
            </Badge>
          )}
          {formatHeadgear(runner.headgear) && (
            <Badge variant="outline" className="text-[9px]">
              {formatHeadgear(runner.headgear)}
            </Badge>
          )}
          {isOfferTarget && (
            <Badge
              variant="outline"
              className="border-emerald-500/50 text-[9px] text-emerald-700 dark:text-emerald-300"
              title={runner.offerTargetSummary}
            >
              offer target
            </Badge>
          )}
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{runner.form ?? "—"}</p>
      </td>
      <td className="hidden px-2 py-2.5 text-sm text-muted-foreground md:table-cell">
        <span className="block truncate">{runner.jockey}</span>
        <span className="block truncate text-xs">
          {runner.trainer}
          {runner.jockeyClaim != null && runner.jockeyClaim > 0 && (
            <span className="text-muted-foreground/80"> · {runner.jockeyClaim}lb claim</span>
          )}
        </span>
      </td>
      <td className="hidden w-10 px-2 py-2.5 text-center tabular-nums sm:table-cell">
        {runner.age ?? "—"}
      </td>
      <td className="hidden w-12 px-2 py-2.5 text-center tabular-nums sm:table-cell">
        {runner.weightLbs ? formatWeightStones(runner.weightLbs) : runner.weight ?? "—"}
      </td>
      <td className="w-16 px-2 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5 font-bold tabular-nums">
          <PriceMovementArrow movement={runner.movement} />
          {formatDecimalOdds(runner.bookieDecimal)}
        </div>
        {isProxy && (
          <div className="text-[9px] text-amber-600 dark:text-amber-400">est.</div>
        )}
      </td>
      <td className="hidden w-16 px-2 py-2.5 text-right sm:table-cell">
        <div className="font-semibold tabular-nums text-muted-foreground">
          {formatDecimalOdds(runner.exchangeDecimal)}
        </div>
        {isLiveExchange ? (
          <div className="text-[9px] text-emerald-600 dark:text-emerald-400">live lay</div>
        ) : runner.exchangeSource === "estimated" && advancedMode ? (
          <div className="text-[9px] text-amber-600 dark:text-amber-400">est. +3%</div>
        ) : null}
        {advancedMode && runner.spreadPct != null && (
          <div className={cn("text-[9px] tabular-nums", spreadTone(runner.spreadPct))}>
            +{runner.spreadPct.toFixed(1)}%
          </div>
        )}
      </td>
      <td className={cn("w-20 px-2 py-2.5 text-right", !advancedMode && "hidden")}>
        <PriceMovementBadge movement={runner.movement} compact />
      </td>
      <td className="w-28 px-1 py-1.5 text-right">
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Matched lay calculator"
            onClick={() => onBet(race, runner.name, "lay")}
          >
            <TrendingDown className="size-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Add win bet"
            onClick={() => onBet(race, runner.name, "win")}
          >
            <NotebookPen className="size-3.5" />
          </Button>
          {hasPlaceOffer && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Place-refund offer bet"
              onClick={() => onBet(race, runner.name, "place_refund")}
            >
              <Gift className="size-3.5 text-emerald-600" />
            </Button>
          )}
          {bookiePlaces > exchangePlaces && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Extra place bet"
              onClick={() => onBet(race, runner.name, "extra_place")}
            >
              <Calculator className="size-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function FlashscoreRacecard({
  courses,
  selected,
  selectedId,
  onSelectRace,
  bookiePlaces,
  exchangePlaces,
  onTrack,
  onBet,
  advancedMode = false,
  showOfferGuide = true,
}: FlashscoreRacecardProps) {
  const activeCourse = selected?.course ?? courses[0]?.[0] ?? "";
  const courseRaces = courses.find(([c]) => c === activeCourse)?.[1] ?? [];

  const sortedRunners = useMemo(() => {
    if (!selected) return [];
    return [...selected.runners].sort((a, b) => {
      if (a.nonRunner !== b.nonRunner) return a.nonRunner ? 1 : -1;
      const pa = a.bookieDecimal ?? a.spDecimal ?? Infinity;
      const pb = b.bookieDecimal ?? b.spDecimal ?? Infinity;
      return pa - pb;
    });
  }, [selected]);

  if (!selected) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Select a race to view the full racecard.
      </div>
    );
  }

  const hasPlaceOffer = selected.offerTags.some((t) => t.qualifies);
  const startLabel = new Date(selected.startTime).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/50 dark:shadow-none">
      <div className={cn(sectionBar, "text-foreground")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={sectionTitle}>
            {regionLabel(selected.region)}: {activeCourse.toUpperCase()}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-border bg-card text-foreground hover:bg-selection-subtle"
            onClick={() => onTrack(selected)}
          >
            Track race
          </Button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {courseRaces.map((race) => {
            const active = race.externalId === selectedId;
            const qualifies = race.offerTags.some((t) => t.qualifies);
            return (
              <button
                key={race.externalId}
                type="button"
                onClick={() => onSelectRace(race.externalId)}
                className={listPillState(active)}
              >
                {race.offTime || "—"}
                {qualifies && (
                  <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={sectionMeta}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug">
              <Pin className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="uppercase">
                {selected.course}: {selected.raceName}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {selected.type && <span>{selected.type}</span>}
              {selected.distance && <span>{selected.distance}</span>}
              {selected.raceClass && <span>{selected.raceClass}</span>}
              {selected.prize && <span>Prize {selected.prize}</span>}
              {selected.going && <span>Going: {selected.going}</span>}
              <span>
                {selected.fieldSize} runners · {selected.standardPlaces} places
              </span>
              {selected.oddsSource === "proxy" && (
                <span className="text-amber-600 dark:text-amber-400">Est. prices (OFR)</span>
              )}
            </div>
          </div>
          <p className="shrink-0 text-[11px] text-muted-foreground">Start {startLabel}</p>
        </div>
        {hasPlaceOffer && showOfferGuide && (
          <RacingOfferGuide
            race={selected}
            onBack={(runner) => onBet(selected, runner, "place_refund")}
            onLay={(runner) => onBet(selected, runner, "lay")}
            onTrack={() => onTrack(selected)}
          />
        )}
        {hasPlaceOffer && (
          <div className="mt-2 space-y-0.5">
            {selected.offerTags
              .filter((t) => t.qualifies)
              .slice(0, advancedMode ? undefined : 1)
              .map((t) => (
                <p key={t.offerId} className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ {t.offerTitle}
                  {advancedMode && t.score != null ? ` · score ${t.score} — ${t.summary}` : ""}
                  {!advancedMode && t.suggestedRunners?.[0] && (
                    <span className="text-foreground">
                      {" "}
                      · pick <span className="font-semibold">{t.suggestedRunners[0].name}</span>
                    </span>
                  )}
                </p>
              ))}
            {advancedMode &&
              selected.offerTags
                .flatMap((t) => t.suggestedRunners ?? [])
                .filter((r, i, arr) => arr.findIndex((x) => x.horseId === r.horseId) === i)
                .sort((a, b) => (b.totalEv ?? b.score) - (a.totalEv ?? a.score))
                .slice(0, 3)
                .length > 0 && (
                <div className="mt-1.5 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Offer targets
                  </p>
                  {selected.offerTags
                    .flatMap((t) => t.suggestedRunners ?? [])
                    .filter((r, i, arr) => arr.findIndex((x) => x.horseId === r.horseId) === i)
                    .sort((a, b) => (b.totalEv ?? b.score) - (a.totalEv ?? a.score))
                    .slice(0, 3)
                    .map((r) => (
                      <p key={r.horseId} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{r.name}</span>
                        {r.totalEv != null && (
                          <span className="tabular-nums"> · EV £{r.totalEv.toFixed(2)}</span>
                        )}
                        {advancedMode && ` · ${r.summary}`}
                      </p>
                    ))}
                </div>
              )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-selection-subtle/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Cloth</th>
              <th className="px-2 py-2 text-left">Horse</th>
              <th className="hidden px-2 py-2 text-left md:table-cell">Jockey / Trainer</th>
              <th className="hidden px-2 py-2 text-center sm:table-cell">Age</th>
              <th className="hidden px-2 py-2 text-center sm:table-cell">Wt</th>
              <th className="px-2 py-2 text-right">Bookie</th>
              <th className="hidden px-2 py-2 text-right sm:table-cell">Exchange</th>
              <th className={cn("px-2 py-2 text-right", !advancedMode && "hidden")}>Move</th>
              <th className="px-2 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {sortedRunners.map((runner) => (
              <RunnerRow
                key={runner.horseId}
                runner={runner}
                race={selected}
                hasPlaceOffer={hasPlaceOffer}
                bookiePlaces={bookiePlaces}
                exchangePlaces={exchangePlaces}
                onBet={onBet}
                advancedMode={advancedMode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
