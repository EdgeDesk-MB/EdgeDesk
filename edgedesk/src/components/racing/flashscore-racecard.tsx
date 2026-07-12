"use client";

import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDecimalOdds, formatWeightStones } from "@/lib/racing/odds";
import { formatHeadgear } from "@/lib/racing/runner-display";
import { formatClockTime } from "@/lib/time-format";
import type { RacingDeskRace, RacingRunnerDetail } from "@/lib/racing-desk/types";
import { PriceMovementArrow, PriceMovementBadge } from "@/components/racing/price-movement-badge";
import { RacingOfferGuide } from "@/components/racing/racing-offer-guide";
import { RunnerCloth } from "@/components/racing/runner-cloth";
import { RegionFlag } from "@/components/region-flag";
import { Calculator, Gift, NotebookPen, Pin, RotateCcw, TrendingDown } from "lucide-react";
import { formatExchangeMatchError } from "@/lib/services/exchange/format-exchange-error";
import { cn } from "@/lib/utils";
import { darken, lighten } from "@/lib/brands/exchanges";
import { racingRegionLabel } from "@/lib/geo/region";
import { qualifyingOfferTags } from "@/lib/racing/offer-tags";
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
  onBet: (
    race: RacingDeskRace,
    runner: string,
    mode: "win" | "extra_place" | "place_refund" | "lay",
    offerId?: number
  ) => void;
  /** Paste real bookie odds over proxy estimates (Free tier). */
  onOddsOverride?: (
    raceId: string,
    horseId: string,
    bookieDecimal: number | null
  ) => Promise<void>;
  /** Exchange panel colours from Settings default exchange */
  backColor?: string;
  layColor?: string;
  /** Show movement, spread %, expanded offer intel */
  advancedMode?: boolean;
  /** Guided place-refund workflow on qualifying races */
  showOfferGuide?: boolean;
  /** Soft-refresh status shown on the card (avoids page-level layout jump) */
  refreshLabel?: string;
  refreshing?: boolean;
  exchangeStatusLabel?: string;
  /** Bookmaker name → brand hex color for near-minimum runner dots */
  bookmakerColors?: Map<string, string>;
}

function spreadTone(spreadPct?: number): string {
  if (spreadPct == null) return "text-muted-foreground";
  if (spreadPct <= 3) return "text-emerald-600 dark:text-emerald-400";
  if (spreadPct <= 8) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function formatLaySize(size?: number): string | null {
  if (size == null || !(size > 0)) return null;
  if (size >= 1000) return `£${(size / 1000).toFixed(size >= 10000 ? 0 : 1)}k`;
  return `£${Math.round(size)}`;
}

/**
 * Exchange-branded odds cell - same lighten/darken pattern as calculator Back/Lay panels.
 * Light mode: pastel tint. Dark mode: deep panel tint (0.72) so cells match the calc, not washed mid-tones.
 */
function oddsCellStyle(hex?: string): CSSProperties | undefined {
  if (!hex) return undefined;
  return {
    "--odds-cell": lighten(hex, 0.72),
    "--odds-cell-dark": darken(hex, 0.72),
  } as CSSProperties;
}

const oddsCellClass =
  "bg-[var(--odds-cell)] text-black/85 dark:bg-[var(--odds-cell-dark)] dark:text-white/95";

function BookieOddsCell({
  runner,
  raceId,
  onOddsOverride,
  backColor,
}: {
  runner: RacingRunnerDetail;
  raceId: string;
  onOddsOverride?: FlashscoreRacecardProps["onOddsOverride"];
  backColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const isProxy = runner.oddsSource === "proxy";
  const isManual = runner.oddsSource === "manual" || runner.oddsOverridden;
  const cellStyle = oddsCellStyle(backColor);

  async function commit() {
    if (!onOddsOverride) {
      setEditing(false);
      return;
    }
    const trimmed = draft.trim();
    setSaving(true);
    try {
      if (!trimmed) {
        await onOddsOverride(raceId, runner.horseId, null);
      } else {
        const n = parseFloat(trimmed);
        if (!Number.isFinite(n) || n <= 1) {
          setEditing(false);
          return;
        }
        await onOddsOverride(raceId, runner.horseId, n);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function clearOverride(e: MouseEvent) {
    e.stopPropagation();
    if (!onOddsOverride || !isManual) return;
    setSaving(true);
    try {
      await onOddsOverride(raceId, runner.horseId, null);
    } finally {
      setSaving(false);
    }
  }

  if (editing && onOddsOverride) {
    return (
      <td className={cn("w-[4.5rem] px-1 py-1.5 text-right", cellStyle && oddsCellClass)} style={cellStyle}>
        <Input
          autoFocus
          type="text"
          inputMode="decimal"
          className="h-7 w-14 px-1 text-right text-xs tabular-nums"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={`Override bookie odds for ${runner.name}`}
        />
      </td>
    );
  }

  return (
    <td
      className={cn("w-[4.5rem] px-1.5 py-2.5 text-right", cellStyle && oddsCellClass)}
      style={cellStyle}
    >
      <div className="flex items-start justify-end gap-0.5">
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 text-right",
            onOddsOverride && "cursor-text rounded hover:bg-black/5 dark:hover:bg-white/10"
          )}
          title={
            onOddsOverride
              ? isManual
                ? "Click to edit · empty or reset clears override"
                : "Click to paste real bookie odds"
              : undefined
          }
          disabled={!onOddsOverride}
          onClick={() => {
            if (!onOddsOverride) return;
            setDraft(
              runner.bookieDecimal != null && runner.bookieDecimal > 1
                ? String(runner.bookieDecimal)
                : ""
            );
            setEditing(true);
          }}
        >
          <div className="flex items-center justify-end gap-0.5 font-bold tabular-nums">
            <PriceMovementArrow movement={runner.movement} />
            {formatDecimalOdds(runner.bookieDecimal)}
          </div>
          {isManual ? (
            <div className="text-[9px] font-medium text-sky-700 dark:text-sky-300">manual</div>
          ) : isProxy ? (
            <div className="text-[9px] text-amber-700/90 dark:text-amber-300">est.</div>
          ) : runner.bookieDecimal == null && onOddsOverride ? (
            <div className="text-[9px] text-muted-foreground">paste</div>
          ) : null}
        </button>
        {isManual && onOddsOverride && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-sky-700 hover:text-sky-900 dark:text-sky-300"
            title="Reset to API / proxy odds"
            disabled={saving}
            onClick={(e) => void clearOverride(e)}
          >
            <RotateCcw className="size-3" />
          </Button>
        )}
      </div>
    </td>
  );
}

function RunnerRow({
  runner,
  race,
  hasPlaceOffer,
  bookiePlaces,
  exchangePlaces,
  onBet,
  onOddsOverride,
  backColor,
  layColor,
  advancedMode = false,
}: {
  runner: RacingRunnerDetail;
  race: RacingDeskRace;
  hasPlaceOffer: boolean;
  bookiePlaces: number;
  exchangePlaces: number;
  onBet: FlashscoreRacecardProps["onBet"];
  onOddsOverride?: FlashscoreRacecardProps["onOddsOverride"];
  backColor?: string;
  layColor?: string;
  advancedMode: boolean;
}) {
  const isSteamer = runner.movement?.change != null && runner.movement.change < -0.05;
  const isDrifter = runner.movement?.change != null && runner.movement.change > 0.05;
  const hasSnapshots = (runner.movement?.snapshotCount ?? 0) >= 2;
  const isOfferTarget = (runner.offerTargetScore ?? 0) >= 35;
  const isLiveExchange = runner.exchangeSource === "live";
  const layStyle = oddsCellStyle(layColor);
  const laySizeLabel = formatLaySize(runner.exchangeLaySize);
  const exchMove = runner.exchangeMovement;
  const exchSteamer = exchMove?.change != null && exchMove.change < -0.05;
  const exchDrifter = exchMove?.change != null && exchMove.change > 0.05;

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
          <RegionFlag code={race.region} className="opacity-90" />
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
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{runner.form ?? "-"}</p>
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
        {runner.age ?? "-"}
      </td>
      <td className="hidden w-12 px-2 py-2.5 text-center tabular-nums sm:table-cell">
        {runner.weightLbs ? formatWeightStones(runner.weightLbs) : runner.weight ?? "-"}
      </td>
      <BookieOddsCell
        runner={runner}
        raceId={race.externalId}
        onOddsOverride={onOddsOverride}
        backColor={backColor}
      />
      <td
        className={cn(
          "hidden w-20 px-2 py-2.5 text-right sm:table-cell",
          layStyle && oddsCellClass
        )}
        style={layStyle}
      >
        <div className="flex items-center justify-end gap-0.5">
          {isLiveExchange && (exchSteamer || exchDrifter) && (
            <PriceMovementArrow movement={exchMove} />
          )}
          <span className="font-semibold tabular-nums">
            {formatDecimalOdds(runner.exchangeDecimal)}
          </span>
        </div>
        {laySizeLabel && isLiveExchange && (
          <div
            className="text-[9px] tabular-nums text-muted-foreground dark:text-white/70"
            title="Available at best lay"
          >
            {laySizeLabel}
          </div>
        )}
        {isLiveExchange ? (
          <div className="text-[9px] font-medium text-emerald-700 dark:text-emerald-300">live lay</div>
        ) : runner.exchangeSource === "estimated" ? (
          <div className="text-[9px] text-amber-700/90 dark:text-amber-300">est. +3%</div>
        ) : runner.exchangeDecimal != null ? (
          <div className="text-[9px] text-muted-foreground">exch.</div>
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
  onOddsOverride,
  backColor,
  layColor,
  advancedMode = false,
  showOfferGuide = true,
  refreshLabel,
  refreshing = false,
  exchangeStatusLabel,
  bookmakerColors,
}: FlashscoreRacecardProps) {
  const activeCourse = selected?.course ?? courses[0]?.[0] ?? "";
  const courseRaces = courses.find(([c]) => c === activeCourse)?.[1] ?? [];

  const sortedRunners = useMemo(() => {
    if (!selected) return [];
    return [...selected.runners].sort((a, b) => {
      if (a.nonRunner !== b.nonRunner) return a.nonRunner ? 1 : -1;
      // Favourite first by live exchange lay (bookie often blank on Free tier)
      const pa = a.exchangeDecimal ?? a.bookieDecimal ?? a.spDecimal ?? Infinity;
      const pb = b.exchangeDecimal ?? b.bookieDecimal ?? b.spDecimal ?? Infinity;
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
  const startDate = new Date(selected.startTime);
  const startLabel = `${startDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  })}, ${formatClockTime(startDate)}`;

  return (
    <div className="surface-lift overflow-hidden rounded-lg ring-1 ring-border/50 dark:shadow-none">
      <div className={cn(sectionBar, "text-foreground")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(sectionTitle, "flex items-center gap-1.5")}>
            <RegionFlag code={selected.region} size="md" />
            <span>
              {racingRegionLabel(selected.region).toUpperCase()}: {activeCourse.toUpperCase()}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {(refreshLabel || exchangeStatusLabel) && (
              <p
                className="hidden max-w-[16rem] truncate text-[10px] tabular-nums text-muted-foreground sm:block"
                title={[refreshLabel, exchangeStatusLabel].filter(Boolean).join(" · ")}
              >
                {refreshing ? (
                  <span className="text-foreground/80">Updating…</span>
                ) : (
                  refreshLabel
                )}
                {exchangeStatusLabel ? (
                  <span className="text-muted-foreground/80"> · {exchangeStatusLabel}</span>
                ) : null}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-border bg-card text-foreground hover:bg-selection-subtle"
              onClick={() => onTrack(selected)}
            >
              Track race
            </Button>
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {courseRaces.map((race) => {
            const active = race.externalId === selectedId;
            const isFinished =
              race.status === "finished" ||
              (race.status === "upcoming" && race.startTime < Date.now());
            const offerCount = qualifyingOfferTags(race).length;
            const nearMinTags = race.offerTags.filter(
              (t) =>
                t.qualifies &&
                t.minRunners != null &&
                race.fieldSize >= t.minRunners &&
                race.fieldSize <= t.minRunners + 2
            );
            return (
              <button
                key={race.externalId}
                type="button"
                onClick={() => onSelectRace(race.externalId)}
                className={cn(
                  listPillState(active),
                  isFinished && !active && "text-muted-foreground/50"
                )}
              >
                {race.startTime ? formatClockTime(race.startTime) : race.offTime || "-"}
                {offerCount > 0 && (
                  <span
                    className="ml-1 inline-flex min-w-[1rem] translate-y-[-1px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[9px] font-bold tabular-nums text-emerald-800 dark:text-emerald-300"
                    title={`${offerCount} qualifying offer${offerCount === 1 ? "" : "s"}`}
                  >
                    {offerCount}
                  </span>
                )}
                {nearMinTags.map((tag) => {
                  const color = tag.bookmaker ? (bookmakerColors?.get(tag.bookmaker) ?? null) : null;
                  return (
                    <span
                      key={tag.offerId}
                      className="inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full"
                      style={{
                        marginLeft: "6px",
                        ...(color ? { backgroundColor: color } : { backgroundColor: "currentColor", opacity: 0.5 }),
                      }}
                      title={`${tag.bookmaker ?? "Offer"}: ${race.fieldSize} runners (near min. ${tag.minRunners})`}
                    />
                  );
                })}
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
                <span className="text-amber-600 dark:text-amber-400">Est. bookie (OFR)</span>
              )}
              {selected.oddsSource === "manual" && (
                <span className="text-sky-600 dark:text-sky-400">Manual bookie odds</span>
              )}
              {(selected.liveLayCount ?? 0) > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Betfair lays · {selected.liveLayCount}/{selected.runners.filter((r) => !r.nonRunner).length}
                </span>
              ) : selected.exchangeMatchError ? (
                <span
                  className="text-amber-600 dark:text-amber-400"
                  title={selected.exchangeMatchError}
                >
                  Exchange est. (+3%) · {formatExchangeMatchError(selected.exchangeMatchError)}
                </span>
              ) : selected.exchangeSource === "estimated" ? (
                <span className="text-amber-600 dark:text-amber-400">Exchange est. (+3%)</span>
              ) : null}
            </div>
          </div>
          <p className="shrink-0 text-[11px] text-muted-foreground">Start {startLabel}</p>
        </div>
        {hasPlaceOffer && showOfferGuide && (
          <RacingOfferGuide
            race={selected}
            onBack={(runner, offerId) => onBet(selected, runner, "place_refund", offerId)}
            onLay={(runner, offerId) => onBet(selected, runner, "lay", offerId)}
            onTrack={() => onTrack(selected)}
          />
        )}
        {hasPlaceOffer &&
          advancedMode &&
          selected.offerTags
            .flatMap((t) => t.suggestedRunners ?? [])
            .filter((r, i, arr) => arr.findIndex((x) => x.horseId === r.horseId) === i)
            .sort((a, b) => (b.totalEv ?? b.score) - (a.totalEv ?? a.score))
            .slice(0, 3)
            .length > 0 && (
            <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
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
                    {` · ${r.summary}`}
                  </p>
                ))}
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
                onOddsOverride={onOddsOverride}
                backColor={backColor}
                layColor={layColor}
                advancedMode={advancedMode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
