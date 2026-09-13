"use client";

import { useNow } from "@/hooks/use-now";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PressButton } from "@/components/ui/button-3d";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatDecimalOdds,
  formatSpOddsDisplay,
  formatWeightStones,
  spLabelMarksFavourite,
} from "@/lib/racing/odds";
import {
  formatHeadgear,
  formatHorseColour,
  formatLastRun,
  formatRaceClassLabel,
  formatSex,
} from "@/lib/racing/runner-display";
import { formatClockTime } from "@/lib/time-format";
import type { RacingDeskRace, RacingRunnerDetail } from "@/lib/racing-desk/types";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { formatPositionOrdinal } from "@/lib/racing";
import {
  buildFreeBetPlaceBlocks,
  type FreeBetPlaceResultContext,
} from "@/lib/racing/free-bet-place-blocks";
import {
  formatRaceOffClock,
  isDeskRaceInPlay,
  isDeskRaceStatusPreOff,
  isWithinRaceOffCountdown,
  isWithinRaceOffGrace,
  needsRaceOffFineClock,
} from "@/lib/racing-desk/in-play";
import { isDeskRacePast } from "@/lib/racing-desk/past";
import { PriceMovementArrow, PriceMovementBadge } from "@/components/racing/price-movement-badge";
import { EmptyState } from "@/components/help/empty-state";
import { RacingInPlayEmpty } from "@/components/racing/racing-in-play-empty";
import { RacingOfferGuide } from "@/components/racing/racing-offer-guide";
import { RunnerCloth } from "@/components/racing/runner-cloth";
import { RegionFlag } from "@/components/region-flag";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Gift,
  Layers2,
  NotebookPen,
  TrendingDown,
  Zap,
} from "lucide-react";
import { formatExchangeMatchError } from "@/lib/services/exchange/format-exchange-error";
import { cn } from "@/lib/utils";
import { oddsCellClass, oddsCellStyle } from "@/lib/ui/odds-cell";
import { racingRegionLabel } from "@/lib/geo/region";
import { countRecommendedOffersOnRace } from "@/lib/racing/offer-tags";
import {
  edgeMarkerPill,
  backedNavTag,
  edgeNavTag,
  listPillState,
  listRow,
  deskBandPad,
  deskInsetX,
  sectionMeta,
  captionHeading,
  panelSurface,
  tableEdgeEnd,
  tableEdgeStart,
} from "@/lib/ui/surface-styles";

const DESK_DECIMAL_ODDS_KEY = "edgeways:racing-desk-decimal-odds";
const IN_PLAY_DISMISS_KEY = "edgeways:racing-in-play-dismissed";

function readDeskDecimalOdds(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DESK_DECIMAL_ODDS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDeskDecimalOdds(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DESK_DECIMAL_ODDS_KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function loadInPlayDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(IN_PLAY_DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveInPlayDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(IN_PLAY_DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

function raceHasResult(race: RacingDeskRace): boolean {
  return Boolean(race.winner) || race.runners.some((r) => (r.finishingPosition ?? 0) > 0);
}

/** Horse ids that are SP favourites (explicit mark, or joint shortest SP). */
function spFavouriteHorseIds(runners: RacingRunnerDetail[]): Set<string> {
  const explicit = runners.filter((r) =>
    spLabelMarksFavourite(r.spFraction, r.isSpFavourite)
  );
  if (explicit.length > 0) return new Set(explicit.map((r) => r.horseId));

  const withSp = runners.filter(
    (r) => !r.nonRunner && r.spDecimal != null && r.spDecimal > 1
  );
  if (withSp.length === 0) return new Set();
  const min = Math.min(...withSp.map((r) => r.spDecimal!));
  return new Set(withSp.filter((r) => r.spDecimal === min).map((r) => r.horseId));
}

/** Result context for SP-favourite hatch gating. */
function freeBetResultContext(runners: RacingRunnerDetail[]): FreeBetPlaceResultContext {
  const favIds = spFavouriteHorseIds(runners);
  if (favIds.size === 0) {
    return { winnerWasSpFavourite: null, favouriteSpOdds: null };
  }
  const favSps = runners
    .filter((r) => favIds.has(r.horseId))
    .map((r) => r.spDecimal)
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 1);
  const favouriteSpOdds = favSps.length > 0 ? Math.min(...favSps) : null;
  const winner = runners.find((r) => r.finishingPosition === 1);
  if (!winner) {
    return { winnerWasSpFavourite: null, favouriteSpOdds };
  }
  return {
    winnerWasSpFavourite: favIds.has(winner.horseId),
    favouriteSpOdds,
  };
}

export interface DeskRacecardProps {
  courses: Array<[string, RacingDeskRace[]]>;
  selected: RacingDeskRace | null;
  selectedId: string | null;
  onSelectRace: (id: string) => void;
  bookiePlaces: number;
  exchangePlaces: number;
  onTrack: (race: RacingDeskRace) => void;
  onUntrack: (race: RacingDeskRace) => void;
  onBet: (
    race: RacingDeskRace,
    runner: string,
    mode: "win" | "each_way" | "extra_place" | "place_refund" | "lay",
    offerId?: number
  ) => void;
  /** Exchange panel colours from Settings default exchange */
  layColor?: string;
  /** Show movement, spread %, expanded offer intel */
  advancedMode?: boolean;
  onAdvancedModeChange?: (v: boolean) => void;
  /** Guided place-refund workflow on qualifying races */
  showOfferGuide?: boolean;
  /** Soft-refresh status shown on the card (avoids page-level layout jump) */
  refreshLabel?: string;
  refreshing?: boolean;
  exchangeStatusLabel?: string;
  /** Desk exchange picker, rendered beside Track race */
  exchangeControl?: ReactNode;
  /** Bookmaker name → brand hex color for near-minimum runner dots */
  bookmakerColors?: Map<string, string>;
  /** Modelled Offer Edge plays (Race picks / workflow share this list). */
  edgePlays?: OfferEdgePlay[];
  /**
   * Edge count pills on race-time tabs. On in Qualifying so picks still stand
   * out; off in All races and Race picks (totals live on the filter pills).
   */
  showEdgeTabCounters?: boolean;
  /**
   * Expand Offer workflow + picks by default. Off in All races; on for
   * Qualifying and Race picks.
   */
  defaultGuideExpanded?: boolean;
  dataSource?: "demo" | "racing-api" | "error";
  /** Nested in the Courses card — drop outer plate, use a top rule. */
  embedded?: boolean;
}

function spreadTone(spreadPct?: number): string {
  if (spreadPct == null) return "text-muted-foreground";
  if (spreadPct <= 3) return "text-profit";
  if (spreadPct <= 8) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function formatLaySize(size?: number): string | null {
  if (size == null || !(size > 0)) return null;
  if (size >= 1000) return `£${(size / 1000).toFixed(size >= 10000 ? 0 : 1)}k`;
  return `£${Math.round(size)}`;
}

function RunnerActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}


/** One contiguous free-bet place run (merged when offers overlap/adjoin). */
type FreeBetPlaceRail = {
  places: Set<number>;
  /** Horse ids in finish order for this run. */
  horseIds: string[];
  title: string;
};

type FreeBetPlaceZone = {
  allPlaces: Set<number>;
  rails: FreeBetPlaceRail[];
};

function RunnerRow({
  runner,
  race,
  hasPlaceOffer,
  bookiePlaces,
  exchangePlaces,
  onBet,
  layColor,
  advancedMode = false,
  isRecommended,
  resultMode = false,
  hideOffers = false,
  decimalOdds = false,
  isSpFavourite = false,
  freeBetPlaces = null,
  onRowRef,
}: {
  runner: RacingRunnerDetail;
  race: RacingDeskRace;
  hasPlaceOffer: boolean;
  bookiePlaces: number;
  exchangePlaces: number;
  onBet: DeskRacecardProps["onBet"];
  layColor?: string;
  advancedMode: boolean;
  /** Offer Edge recommended runner for this race. */
  isRecommended?: boolean;
  /** Finished race with placings — finish-order result columns. */
  resultMode?: boolean;
  /** Past race: suppress gift / Edge / estimate chrome. */
  hideOffers?: boolean;
  /** Result view: show SP as decimal (keep F / Fav / JFav). */
  decimalOdds?: boolean;
  /** SP favourite — “Favourite” tag beside the horse name. */
  isSpFavourite?: boolean;
  /** Qualifying free-bet finish positions (result hatch). */
  freeBetPlaces?: Set<number> | null;
  onRowRef?: (horseId: string, el: HTMLTableRowElement | null) => void;
}) {
  const isSteamer = runner.movement?.change != null && runner.movement.change < -0.05;
  const isDrifter = runner.movement?.change != null && runner.movement.change > 0.05;
  const hasSnapshots = (runner.movement?.snapshotCount ?? 0) >= 2;
  const showOfferChrome = !hideOffers && !resultMode;
  const isOfferTarget =
    showOfferChrome && !isRecommended && (runner.offerTargetScore ?? 0) >= 35;
  const showRecommended = showOfferChrome && !!isRecommended;
  const isLiveExchange = runner.exchangeSource === "live";
  const layStyle = oddsCellStyle(layColor);
  const laySizeLabel = formatLaySize(runner.exchangeLaySize);
  const exchMove = runner.exchangeMovement;
  const exchSteamer = exchMove?.change != null && exchMove.change < -0.05;
  const exchDrifter = exchMove?.change != null && exchMove.change > 0.05;
  const headgearLabel = formatHeadgear(runner.headgear);
  const colourLabel = advancedMode ? formatHorseColour(runner.horseColour) : undefined;
  const sexLabel = advancedMode ? formatSex(runner.sex) : undefined;
  const lastRunLabel = formatLastRun(runner.lastRunDays);
  const posLabel = formatPositionOrdinal(runner.finishingPosition ?? 0);
  const finishPos = runner.finishingPosition ?? 0;
  const isWinner = finishPos === 1;
  const isFreeBetPlace = Boolean(freeBetPlaces?.has(finishPos));
  const betMark = runner.betMark;
  const spDisplay = formatSpOddsDisplay(
    {
      spFraction: runner.spFraction,
      spDecimal: runner.spDecimal,
      isSpFavourite: isSpFavourite || runner.isSpFavourite,
    },
    { decimal: decimalOdds }
  );

  return (
    <tr
      ref={(el) => onRowRef?.(runner.horseId, el)}
      className={cn(
        listRow,
        !resultMode && isSteamer && "bg-emerald-500/5",
        showRecommended && "bg-edge/8",
        !showRecommended && isOfferTarget && "bg-muted/40",
        resultMode && isWinner && "bg-success/5",
        resultMode && isFreeBetPlace && "free-bet-place-row",
        betMark?.kind === "open" && "bg-selection-subtle/80"
      )}
    >
      {resultMode ? (
        <td className={cn("w-12 py-2.5 pr-2 text-center", tableEdgeStart)}>
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              isWinner ? "text-foreground" : "text-muted-foreground"
            )}
            title={posLabel ? `Finished ${posLabel}` : "Unplaced"}
          >
            {posLabel ?? "-"}
          </span>
        </td>
      ) : null}
      <td
        className={cn(
          "w-10 py-2.5 pr-2 text-center",
          resultMode ? "pl-2" : tableEdgeStart
        )}
      >
        <RunnerCloth number={runner.number} silkUrl={runner.silkUrl} size="sm" />
      </td>
      <td
        className="w-10 px-2 py-2.5 text-center text-xs tabular-nums text-muted-foreground"
        title={
          runner.draw && runner.draw !== "0" ? `Draw ${runner.draw}` : "Draw"
        }
      >
        {runner.draw && runner.draw !== "0" ? runner.draw : "-"}
      </td>
      <td className="min-w-[10rem] px-2 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <RegionFlag code={race.region} className="opacity-90" />
          <span className="font-semibold leading-tight">{runner.name}</span>
          {resultMode && isSpFavourite && (
            <Badge
              variant="outline"
              className="border-amber-600/40 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
              title="Starting Price favourite"
            >
              Favourite
            </Badge>
          )}
          {!resultMode && isSteamer && (
            <Badge variant="outline" className="border-profit/40 text-[11px] text-profit">
              steamer
            </Badge>
          )}
          {!resultMode && isDrifter && hasSnapshots && (
            <Badge variant="outline" className="border-red-500/40 text-[11px] text-red-600">
              drifter
            </Badge>
          )}
          {!resultMode && headgearLabel && (
            <Badge variant="outline" className="text-[11px]">
              {headgearLabel}
            </Badge>
          )}
          {!resultMode && sexLabel && (
            <Badge variant="outline" className="text-[11px]" title="Sex">
              {sexLabel}
            </Badge>
          )}
          {!resultMode && colourLabel && (
            <Badge variant="outline" className="text-[11px]" title="Colour">
              {colourLabel}
            </Badge>
          )}
          {showRecommended && (
            <span className={edgeNavTag} title="Offer Edge recommended play">
              Edge
            </span>
          )}
          {betMark != null && (
            <span
              className={backedNavTag}
              title={
                betMark.kind === "open"
                  ? betMark.betCount > 1
                    ? `${betMark.betCount} open bets on this runner`
                    : "Open bet on this runner"
                  : betMark.betCount > 1
                    ? `${betMark.betCount} settled bets on this runner`
                    : "Settled bet on this runner"
              }
            >
              <Check className="size-3 stroke-[2.5]" aria-hidden />
              Backed
              {betMark.betCount > 1 ? ` · ${betMark.betCount}` : ""}
            </span>
          )}
          {isOfferTarget && (
            <Badge
              variant="outline"
              className="border-border text-[11px] text-muted-foreground"
              title={runner.offerTargetSummary}
            >
              estimate
            </Badge>
          )}
        </div>
        {!resultMode && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {runner.form ?? "-"}
            {lastRunLabel ? (
              <span className="ml-1.5 font-sans text-muted-foreground/80" title="Days since last run">
                · {lastRunLabel}
              </span>
            ) : null}
          </p>
        )}
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
      {!resultMode && (
        <td
          className="hidden w-10 px-2 py-2.5 text-center tabular-nums sm:table-cell"
          title={runner.ofr ? `Official rating ${runner.ofr}` : "Official rating"}
        >
          {runner.ofr ?? "-"}
        </td>
      )}
      <td className="hidden w-12 px-2 py-2.5 text-center tabular-nums sm:table-cell">
        {runner.weightLbs ? formatWeightStones(runner.weightLbs) : runner.weight ?? "-"}
      </td>
      {resultMode ? (
        <>
          <td
            className="hidden w-14 px-2 py-2.5 text-center tabular-nums text-muted-foreground sm:table-cell"
            title="Distance beaten"
          >
            {(runner.finishingPosition ?? 0) === 1 ? "" : runner.btn ?? "-"}
          </td>
          <td
            className={cn(
              "min-w-[4.5rem] py-2.5 pl-2 text-right font-semibold tabular-nums whitespace-nowrap",
              tableEdgeEnd,
              isSpFavourite && "text-amber-900 dark:text-amber-100"
            )}
            title={isSpFavourite ? "Starting Price favourite" : "Starting Price"}
          >
            {spDisplay}
          </td>
        </>
      ) : (
        <>
          <td
            className={cn(
              "w-20 px-2 py-2.5 text-right",
              layStyle && oddsCellClass
            )}
            style={layStyle}
          >
            <div className="flex items-center justify-end gap-0.5">
              {isLiveExchange && (exchSteamer || exchDrifter) && (
                exchSteamer ? (
                  <ChevronDown
                    className={cn("size-3 shrink-0 text-profit", "live-odds-chevron-down")}
                    aria-hidden
                  />
                ) : (
                  <ChevronUp
                    className={cn("size-3 shrink-0 text-negative", "live-odds-chevron-up")}
                    aria-hidden
                  />
                )
              )}
              <span className="font-semibold tabular-nums">
                {formatDecimalOdds(runner.exchangeDecimal)}
              </span>
            </div>
            {laySizeLabel && isLiveExchange && (
              <div
                className="text-[11px] tabular-nums text-muted-foreground dark:text-white/70"
                title="Available at best lay"
              >
                {laySizeLabel}
              </div>
            )}
            {isLiveExchange ? (
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                live lay
              </div>
            ) : runner.exchangeSource === "estimated" ? (
              <div className="text-[11px] text-amber-700/90 dark:text-amber-300">est. +3%</div>
            ) : runner.exchangeDecimal != null ? (
              <div className="text-[11px] text-muted-foreground">exch.</div>
            ) : null}
            {advancedMode && runner.spreadPct != null && (
              <div className={cn("text-[11px] tabular-nums", spreadTone(runner.spreadPct))}>
                +{runner.spreadPct.toFixed(1)}%
              </div>
            )}
          </td>
          <td className={cn("w-20 px-2 py-2.5 text-right", !advancedMode && "hidden")}>
            <PriceMovementBadge movement={runner.movement} compact />
          </td>
          <td className="w-28 py-1.5 pl-1 pr-3 text-right">
            <div className="flex justify-end gap-0.5">
              <RunnerActionButton
                label="Matched lay calculator"
                onClick={() => onBet(race, runner.name, "lay")}
              >
                <TrendingDown className="size-3.5 text-muted-foreground" />
              </RunnerActionButton>
              <RunnerActionButton
                label="Add win bet"
                onClick={() => onBet(race, runner.name, "win")}
              >
                <NotebookPen className="size-3.5" />
              </RunnerActionButton>
              <RunnerActionButton
                label="Each-way calculator"
                onClick={() => onBet(race, runner.name, "each_way")}
              >
                <Layers2 className="size-3.5" />
              </RunnerActionButton>
              {showOfferChrome && hasPlaceOffer && (
                <RunnerActionButton
                  label="Place-refund offer bet"
                  onClick={() => onBet(race, runner.name, "place_refund")}
                >
                  <Gift className="size-3.5 text-profit" />
                </RunnerActionButton>
              )}
              {!hideOffers && bookiePlaces > exchangePlaces && (
                <RunnerActionButton
                  label="Extra place calculator"
                  onClick={() => onBet(race, runner.name, "extra_place")}
                >
                  <Calculator className="size-3.5" />
                </RunnerActionButton>
              )}
            </div>
          </td>
        </>
      )}
    </tr>
  );
}

export function DeskRacecard({
  courses,
  selected,
  selectedId,
  onSelectRace,
  bookiePlaces,
  exchangePlaces,
  onTrack,
  onUntrack,
  onBet,
  layColor,
  advancedMode = false,
  onAdvancedModeChange,
  showOfferGuide = true,
  refreshLabel,
  refreshing = false,
  exchangeStatusLabel,
  exchangeControl,
  bookmakerColors,
  edgePlays = [],
  showEdgeTabCounters = false,
  defaultGuideExpanded = true,
  dataSource,
  embedded = false,
}: DeskRacecardProps) {
  // Coarse tick for browsing; second tick when the selected race is near/past off
  // so grace, countdown, and interstitial swap stay accurate.
  const coarseRefreshMs = 30_000;
  const coarseNow = useNow(coarseRefreshMs);
  const fineNow = useNow(1000);
  const needsFineClock =
    selected != null &&
    !raceHasResult(selected) &&
    needsRaceOffFineClock(selected.startTime, coarseNow, coarseRefreshMs);
  const now = needsFineClock ? fineNow : coarseNow;
  const activeCourse = selected?.course ?? courses[0]?.[0] ?? "";
  const courseRaces = courses.find(([c]) => c === activeCourse)?.[1] ?? [];
  const recommendedHorseIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(
      edgePlays
        .filter((p) => p.raceExternalId === selected.externalId)
        .map((p) => p.runner.horseId)
    );
  }, [edgePlays, selected]);

  // Mobile progressive disclosure: the runner grid sits behind a tap, per
  // race (switching race collapses it again). Desktop always shows it.
  const [runnersOpenForRace, setRunnersOpenForRace] = useState<string | null>(null);
  const [decimalOdds, setDecimalOdds] = useState(false);
  const [inPlayDismissed, setInPlayDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    // localStorage / sessionStorage are client-only; defer past hydration.
    queueMicrotask(() => {
      if (readDeskDecimalOdds()) setDecimalOdds(true);
      setInPlayDismissed(loadInPlayDismissed());
    });
  }, []);
  const runnersOpen = selected != null && runnersOpenForRace === selected.externalId;

  const resultMode = selected != null && raceHasResult(selected);
  const racePast = selected != null && isDeskRacePast(selected, now);
  const raceInPlay = selected != null && isDeskRaceInPlay(selected, now);
  const withinOffGrace =
    selected != null && isWithinRaceOffGrace(selected.startTime, now);
  const providerPreOff =
    selected != null && isDeskRaceStatusPreOff(selected.raceStatus);
  const inPlayDismissedForRace =
    selected != null && inPlayDismissed.has(selected.externalId);
  const showInPlayEmpty = raceInPlay && !inPlayDismissedForRace && !resultMode;
  // Keep offer chrome through the post-off grace and provider delays; hide once
  // the interstitial would apply, unless the user dismissed it to keep working.
  const hideOffers =
    racePast &&
    !providerPreOff &&
    !withinOffGrace &&
    !(raceInPlay && inPlayDismissedForRace);

  function dismissInPlayEmpty() {
    if (!selected) return;
    setInPlayDismissed((prev) => {
      const next = new Set(prev);
      next.add(selected.externalId);
      saveInPlayDismissed(next);
      return next;
    });
  }
  const favouriteHorseIds = useMemo(
    () => (selected && resultMode ? spFavouriteHorseIds(selected.runners) : new Set<string>()),
    [selected, resultMode]
  );

  const sortedRunners = useMemo(() => {
    if (!selected) return [];
    return [...selected.runners].sort((a, b) => {
      if (a.nonRunner !== b.nonRunner) return a.nonRunner ? 1 : -1;
      if (resultMode) {
        const pa = a.finishingPosition ?? 0;
        const pb = b.finishingPosition ?? 0;
        if (pa > 0 && pb > 0) return pa - pb;
        if (pa > 0) return -1;
        if (pb > 0) return 1;
        return a.name.localeCompare(b.name);
      }
      // Favourite first by live exchange lay (bookie often blank on Free tier)
      const pa = a.exchangeDecimal ?? a.bookieDecimal ?? a.spDecimal ?? Infinity;
      const pb = b.exchangeDecimal ?? b.bookieDecimal ?? b.spDecimal ?? Infinity;
      return pa - pb;
    });
  }, [selected, resultMode]);

  /**
   * Place-refund finishes from all qualifying offers. Contiguous places merge
   * into one hatch + label; gaps (e.g. 2nd vs 4th–5th) stay separate rails.
   */
  const freeBetZone = useMemo((): FreeBetPlaceZone | null => {
    if (!selected || !resultMode) return null;
    const { allPlaces, blocks } = buildFreeBetPlaceBlocks(
      selected.offerTags,
      freeBetResultContext(selected.runners)
    );
    if (allPlaces.size === 0) return null;
    const rails = blocks
      .map((block): FreeBetPlaceRail | null => {
        const places = new Set(block.places);
        const horseIds = sortedRunners
          .filter((r) => places.has(r.finishingPosition ?? 0))
          .map((r) => r.horseId);
        if (horseIds.length === 0) return null;
        return { places, horseIds, title: block.title };
      })
      .filter((r): r is FreeBetPlaceRail => r != null);
    if (rails.length === 0) return null;
    return { allPlaces, rails };
  }, [selected, resultMode, sortedRunners]);

  const runnerGridRef = useRef<HTMLDivElement>(null);
  const runnerRowEls = useRef(new Map<string, HTMLTableRowElement>());
  const [freeBetLabelBoxes, setFreeBetLabelBoxes] = useState<
    Array<{ top: number; height: number; title: string }>
  >([]);

  const setRunnerRowRef = useCallback((horseId: string, el: HTMLTableRowElement | null) => {
    if (el) runnerRowEls.current.set(horseId, el);
    else runnerRowEls.current.delete(horseId);
  }, []);

  const measureFreeBetLabels = useCallback(() => {
    if (!freeBetZone || !runnerGridRef.current) {
      setFreeBetLabelBoxes([]);
      return;
    }
    const shellTop = runnerGridRef.current.getBoundingClientRect().top;
    const boxes: Array<{ top: number; height: number; title: string }> = [];
    for (const rail of freeBetZone.rails) {
      const first = runnerRowEls.current.get(rail.horseIds[0]!);
      const last = runnerRowEls.current.get(rail.horseIds[rail.horseIds.length - 1]!);
      if (!first || !last) continue;
      const fr = first.getBoundingClientRect();
      const lr = last.getBoundingClientRect();
      boxes.push({
        top: fr.top - shellTop,
        height: Math.max(0, lr.bottom - fr.top),
        title: rail.title,
      });
    }
    setFreeBetLabelBoxes(boxes);
  }, [freeBetZone]);

  useLayoutEffect(() => {
    measureFreeBetLabels();
    const shell = runnerGridRef.current;
    if (!shell || !freeBetZone) return;
    const ro = new ResizeObserver(() => measureFreeBetLabels());
    ro.observe(shell);
    for (const rail of freeBetZone.rails) {
      for (const id of rail.horseIds) {
        const el = runnerRowEls.current.get(id);
        if (el) ro.observe(el);
      }
    }
    window.addEventListener("resize", measureFreeBetLabels);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureFreeBetLabels);
    };
  }, [freeBetZone, measureFreeBetLabels, sortedRunners]);

  if (!selected) {
    return (
      <EmptyState
        compact={embedded}
        icon={Layers2}
        title="Select a race"
        description="Pick a meeting from the board to open the full racecard."
        className={embedded ? "rounded-none border-x-0 border-b-0 shadow-none" : undefined}
      />
    );
  }

  const hasPlaceOffer = !hideOffers && selected.offerTags.some((t) => t.qualifies);
  const startDate = new Date(selected.startTime);
  const startLabel = `${startDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  })}, ${formatClockTime(startDate)}`;
  const raceTracked = selected.trackedEventId != null;
  const classLabel = formatRaceClassLabel(selected.raceClass, selected.ratingBand);
  const offClock =
    !resultMode && selected
      ? formatRaceOffClock(selected.startTime, now)
      : null;
  const resultStatusLabel = resultMode
    ? selected.resultIncomplete
      ? "Provisional"
      : "Finished"
    : showInPlayEmpty
      ? "Off"
      : raceInPlay && inPlayDismissedForRace
        ? "Off · card shown"
        : withinOffGrace && offClock
          ? `Holding ${offClock.signed}`
          : providerPreOff && racePast
            ? "Delayed"
            : offClock &&
                offClock.phase === "countdown" &&
                isWithinRaceOffCountdown(selected.startTime, now)
              ? `Off in ${offClock.clock}`
              : racePast
                ? "Awaiting result"
                : null;
  const resultStatusNegative =
    Boolean(resultStatusLabel) &&
    (showInPlayEmpty ||
      withinOffGrace ||
      (raceInPlay && inPlayDismissedForRace) ||
      (racePast && !resultMode && !providerPreOff && resultStatusLabel !== "Awaiting result"));

  return (
    <div
      className={cn(
        "overflow-hidden text-card-foreground",
        embedded
          ? "border-t border-border/60 bg-transparent"
          : panelSurface
      )}
    >
      <div className={cn(deskBandPad, "pb-4 text-foreground")}>
        <p
          className={cn(
            captionHeading,
            "flex items-center gap-1.5 text-[15px] text-foreground"
          )}
        >
          <RegionFlag code={selected.region} size="md" />
          <span>
            {racingRegionLabel(selected.region).toUpperCase()}: {activeCourse.toUpperCase()}
          </span>
        </p>
        <ScrollFadeEdges
          orientation="horizontal"
          dragToScroll
          className="mt-2 flex-none"
          scrollClassName="app-scroll-overlay overflow-x-auto"
          fadeClassName="from-card"
        >
          <div className="flex w-max gap-1">
            {courseRaces.map((race) => {
              const active = race.externalId === selectedId;
              const past = isDeskRacePast(race, now);
              // Qualify totals live on the Qualifying filter pill, not per time.
              const recommendedCount =
                !showEdgeTabCounters || past
                  ? 0
                  : countRecommendedOffersOnRace(edgePlays, race.externalId);
              const openBetRunners = race.runners.filter((r) => r.betMark?.kind === "open").length;
              const backedRunners = race.runners.filter((r) => r.betMark?.kind === "settled").length;
              const betRunnerCount = openBetRunners + backedRunners;
              const nearMinTags = past
                ? []
                : race.offerTags.filter(
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
                    "inline-flex shrink-0 items-center gap-1",
                    past && !active && "text-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  {race.startTime ? formatClockTime(race.startTime) : race.offTime || "-"}
                  {betRunnerCount > 0 && (
                    <span
                      className="inline-flex size-3 shrink-0 items-center justify-center text-success"
                      title={
                        openBetRunners > 0
                          ? `${openBetRunners} runner${openBetRunners === 1 ? "" : "s"} with open bets`
                          : `${backedRunners} runner${backedRunners === 1 ? "" : "s"} backed`
                      }
                    >
                      <Check className="size-3 stroke-[2.5]" aria-hidden />
                    </span>
                  )}
                  {recommendedCount > 0 && (
                    <span
                      className={edgeMarkerPill}
                      title={`${recommendedCount} recommended play${recommendedCount === 1 ? "" : "s"} (Offer Edge)`}
                    >
                      <Zap className="size-3" aria-hidden />
                      {recommendedCount}
                    </span>
                  )}
                  {nearMinTags.map((tag) => {
                    const color = tag.bookmaker
                      ? (bookmakerColors?.get(tag.bookmaker) ?? null)
                      : null;
                    return (
                      <span
                        key={tag.offerId}
                        className="inline-block size-3 shrink-0 rounded-full"
                        style={{
                          ...(color
                            ? { backgroundColor: color }
                            : { backgroundColor: "currentColor", opacity: 0.5 }),
                        }}
                        title={`${tag.bookmaker ?? "Offer"}: ${race.fieldSize} runners (near min. ${tag.minRunners})`}
                      />
                    );
                  })}
                </button>
              );
            })}
          </div>
        </ScrollFadeEdges>
      </div>

      <div className={cn(sectionMeta, "border-t border-border/60 py-4")}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-2">
          <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
            {selected.raceName}
          </p>
          <div className="flex items-center justify-end gap-2 self-center">
            <PressButton
              size="sm"
              variant={raceTracked ? "success" : "outline"}
              toggle
              active={raceTracked}
              onChange={(next) => {
                if (next) onTrack(selected);
                else onUntrack(selected);
              }}
              title={raceTracked ? "Stop tracking this race" : "Track this race"}
            >
              {raceTracked ? (
                <>
                  <Check className="size-3.5" />
                  Tracked
                </>
              ) : (
                "Track race"
              )}
            </PressButton>
            {exchangeControl}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {selected.type && <span>{selected.type}</span>}
            {selected.distance && <span>{selected.distance}</span>}
            {selected.pattern && <span>{selected.pattern}</span>}
            {classLabel && <span>{classLabel}</span>}
            {selected.ageBand && <span>{selected.ageBand}</span>}
            {selected.sexRestriction && <span>{selected.sexRestriction}</span>}
            {selected.prize && <span>Prize {selected.prize}</span>}
            {selected.going && <span>Going: {selected.going}</span>}
            {selected.surface && <span>{selected.surface}</span>}
            <span>
              {selected.fieldSize} runners · {selected.standardPlaces} places
            </span>
            {(selected.liveLayCount ?? 0) > 0 ? (
              <span className="text-profit">
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
          <p className="text-right text-xs text-muted-foreground">
            Start {startLabel}
            {resultStatusLabel ? (
              <span
                className={cn(
                  "ml-2.5 font-semibold uppercase tracking-wide tabular-nums",
                  resultMode && !selected.resultIncomplete
                    ? "text-foreground"
                    : resultStatusNegative
                      ? "text-negative"
                      : "text-muted-foreground"
                )}
              >
                ({resultStatusLabel})
              </span>
            ) : null}
          </p>
        </div>
        {hasPlaceOffer && showOfferGuide && !hideOffers && (
          <RacingOfferGuide
            race={selected}
            edgePlays={edgePlays}
            dataSource={dataSource}
            defaultExpanded={defaultGuideExpanded}
            onBack={(runner, offerId) => onBet(selected, runner, "place_refund", offerId)}
            onLay={(runner, offerId) => onBet(selected, runner, "lay", offerId)}
            onTrack={() => onTrack(selected)}
          />
        )}
      </div>

      {showInPlayEmpty ? (
        <RacingInPlayEmpty
          startTime={selected.startTime}
          onShowRacecard={dismissInPlayEmpty}
        />
      ) : (
        <>
          <div
            className={cn(
              deskBandPad,
              "flex items-center justify-end gap-2 border-t border-border/60"
            )}
          >
            {resultMode ? (
              <>
                <Label
                  htmlFor="desk-decimal-odds"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Decimal odds
                </Label>
                <Switch
                  id="desk-decimal-odds"
                  size="sm"
                  checked={decimalOdds}
                  onCheckedChange={(on) => {
                    setDecimalOdds(on);
                    writeDeskDecimalOdds(on);
                  }}
                />
              </>
            ) : (
              <>
                <Label
                  htmlFor="desk-advanced-view"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Advanced view
                </Label>
                <Switch
                  id="desk-advanced-view"
                  size="sm"
                  checked={advancedMode}
                  onCheckedChange={onAdvancedModeChange}
                  disabled={!onAdvancedModeChange}
                />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setRunnersOpenForRace(runnersOpen ? null : selected.externalId)
            }
            aria-expanded={runnersOpen}
            aria-controls="racecard-runner-grid"
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
          >
            {runnersOpen
              ? "Hide runners"
              : `Show ${selected.runners.filter((r) => !r.nonRunner).length} runners`}
            <ChevronDown
              className={cn("size-4 transition-transform", runnersOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          <TooltipProvider delayDuration={200}>
          <div
            id="racecard-runner-grid"
            ref={runnerGridRef}
            className={cn(
              "relative flex",
              !runnersOpen && "hidden sm:flex"
            )}
          >
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-x-0 border-y border-border/60 bg-selection-subtle/50 text-xs uppercase tracking-wide text-muted-foreground">
                    {resultMode && (
                      <th
                        className={cn(
                          "w-12 border-l-0 py-2 pr-2 text-center",
                          tableEdgeStart
                        )}
                      >
                        Pos
                      </th>
                    )}
                    <th
                      className={cn(
                        "w-10 border-l-0 py-2 pr-2 text-center",
                        resultMode ? "pl-2" : tableEdgeStart
                      )}
                    >
                      Cloth
                    </th>
                    <th className="w-10 px-2 py-2 text-center" title="Stall draw">
                      Dr
                    </th>
                    <th className="px-2 py-2 text-left">Horse</th>
                    <th className="hidden px-2 py-2 text-left md:table-cell">Jockey / Trainer</th>
                    <th className="hidden px-2 py-2 text-center sm:table-cell">Age</th>
                    {!resultMode && (
                      <th className="hidden px-2 py-2 text-center sm:table-cell" title="Official rating">
                        OR
                      </th>
                    )}
                    <th className="hidden px-2 py-2 text-center sm:table-cell">Wt</th>
                    {resultMode ? (
                      <>
                        <th
                          className="hidden px-2 py-2 text-center sm:table-cell"
                          title="Distance beaten"
                        >
                          Dist
                        </th>
                        <th
                          className={cn(
                            "border-r-0 py-2 pl-2 text-right",
                            tableEdgeEnd
                          )}
                        >
                          SP
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-2 text-right">Exchange</th>
                        <th className={cn("px-2 py-2 text-right", !advancedMode && "hidden")}>Move</th>
                        <th
                          className={cn(
                            "border-r-0 py-2 pl-2 text-right",
                            tableEdgeEnd
                          )}
                        />
                      </>
                    )}
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
                      layColor={layColor}
                      advancedMode={advancedMode}
                      isRecommended={!hideOffers && recommendedHorseIds.has(runner.horseId)}
                      resultMode={resultMode}
                      hideOffers={hideOffers}
                      decimalOdds={decimalOdds}
                      isSpFavourite={favouriteHorseIds.has(runner.horseId)}
                      freeBetPlaces={freeBetZone?.allPlaces ?? null}
                      onRowRef={setRunnerRowRef}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {freeBetZone ? (
              <div className="relative w-6 shrink-0 self-stretch">
                <span className="sr-only">
                  Free bet places:{" "}
                  {Array.from(freeBetZone.allPlaces)
                    .sort((a, b) => a - b)
                    .join(", ")}
                </span>
                {freeBetLabelBoxes.map((box, i) => (
                  <div
                    key={`${box.top}-${box.height}-${i}`}
                    className="pointer-events-none absolute inset-x-0 flex items-center justify-center border-l border-violet-500/30 bg-violet-500/10"
                    style={{ top: box.top, height: box.height }}
                    title={box.title}
                    aria-hidden
                  >
                    <span
                      className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                      }}
                    >
                      Free bet
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          </TooltipProvider>
        </>
      )}
      {!showInPlayEmpty && (refreshLabel || exchangeStatusLabel) && (
        <p
          className={cn(
            deskInsetX,
            "mt-3 pb-[var(--layout-section-y)] text-right text-[11px] tabular-nums text-muted-foreground"
          )}
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
    </div>
  );
}
