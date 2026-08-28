"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { MoneyFlow } from "@/components/money-flow";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { ActiveBetsStrip } from "@/components/racing/active-bets-strip";
import { DeskRacecard } from "@/components/racing/desk-racecard";
import { RacingPnlTodayView } from "@/components/racing/racing-pnl-today-view";
import {
  DeskFilterPills,
  RacingIntelligenceDialog,
  RacingIntelligenceTrigger,
  type DeskRaceFilter,
} from "@/components/racing/racing-intelligence-dialog";
import { RacingDeskSettingsDialog } from "@/components/racing/racing-desk-settings-dialog";
import { RacingSettlePrompt } from "@/components/racing/racing-settle-prompt";
import { useAddBet } from "@/components/add-bet-provider";
import { useEachWayCalculator } from "@/components/each-way-calculator-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import {
  Tabs,
  TabsLineBar,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { canUseOfferEdge } from "@/lib/entitlements/offer-edge";
import { deskRunnerLayPrices } from "@/lib/racing/desk-bet-prefill";
import { api, apiGet, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  countRecommendedRaces,
  findOfferTag,
} from "@/lib/racing/offer-tags";
import {
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
} from "@/lib/services/settings-shared";
import type { RacingDeskPayload, RacingDeskRace } from "@/lib/racing-desk/types";
import type { ExchangeProvider } from "@/lib/services/exchange/types";
import { exchangeNameToProvider } from "@/lib/services/exchange/client";
import { placePositions } from "@/lib/racing";
import { ukPlaceTerms } from "@/lib/racing/place-terms";
import {
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trophy,
  Zap,
} from "lucide-react";

/** Client remount TTL — server racecards cache is 15m; keep this shorter for lays. */
const DESK_GET_TTL_MS = 45_000;
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { RegionFlag } from "@/components/region-flag";
import { cn } from "@/lib/utils";
import { deskCardShell, edgeMarkerPill } from "@/lib/ui/surface-styles";
import {
  deskRaceToPendingSettle,
  isDeskRacePendingSettle,
} from "@/lib/racing/pending-settle";

const DESK_EXCHANGE_KEY = "edgeways:racing-desk-exchange";
const DESK_PLACE_FRACTION_KEY = "edgeways:racing-desk-place-fraction";
const EMPTY_EDGE_PLAYS: NonNullable<RacingDeskPayload["edgePlays"]> = [];

/** Summary strip tabs — Races is the default desk board. */
type DeskSummaryTab = "races" | "tracked" | "active_bets" | "pnl";

/** Bet count under Racing P&L — methodology lives in the P&L panel. */
function racingPnlTileSub(settledCount: number, openCount: number): string | undefined {
  const betCount = settledCount + openCount;
  if (betCount === 0) return undefined;
  const bets = betCount === 1 ? "1 bet" : `${betCount} bets`;
  if (openCount > 0 && openCount < betCount) {
    return `${bets} · ${openCount} open`;
  }
  return bets;
}

function readDeskPlaceFraction(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESK_PLACE_FRACTION_KEY);
    if (raw === "0.25" || raw === "0.2") return parseFloat(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function readDeskExchangeOverride(): ExchangeProvider | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DESK_EXCHANGE_KEY);
    if (raw === "betfair" || raw === "betdaq" || raw === "matchbook" || raw === "smarkets") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}
export function RacingDeskView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raceParam = searchParams.get("race");
  const { openAddBet } = useAddBet();
  const { openEachWayCalculator } = useEachWayCalculator();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer, viewOffer } = useOfferDialog();
  const { defaultExchange, exchanges } = useExchanges();
  const { state } = useAppState();
  const canOfferEdge = canUseOfferEdge(state?.settings);
  const offerBetPrefs = state?.settings?.offerBetPrefs ?? {};
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<RacingDeskPayload | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  /** True only on first load - soft polls must not blank the page. */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("race")
  );
  const hasPayloadRef = useRef(false);
  const [bookiePlaces, setBookiePlaces] = useState(4);
  const [exchangePlaces, setExchangePlaces] = useState(3);
  /** null = derive from race UK terms; else force 1/4 or 1/5 from Settings. */
  const [placeFractionOverride, setPlaceFractionOverride] = useState<number | null>(null);
  const [epStake, setEpStake] = useState(10);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [raceFilter, setRaceFilter] = useState<DeskRaceFilter>("all");
  const [deskTab, setDeskTab] = useState<DeskSummaryTab>("races");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showOfferGuide, setShowOfferGuide] = useState(true);
  const [deskExchange, setDeskExchange] = useState<ExchangeProvider | "default">("default");

  useEffect(() => {
    // localStorage is client-only; defer a microtask past hydration.
    queueMicrotask(() => {
      const stored = readDeskExchangeOverride();
      if (stored) setDeskExchange(stored);
      const frac = readDeskPlaceFraction();
      if (frac != null) setPlaceFractionOverride(frac);
    });
  }, []);

  // Adjust-during-render: adopt the settings default stake when it changes.
  const settingsStake = state?.settings?.defaultBackStake;
  const [prevSettingsStake, setPrevSettingsStake] = useState(settingsStake);
  if (prevSettingsStake !== settingsStake) {
    setPrevSettingsStake(settingsStake);
    if (settingsStake != null && settingsStake > 0) setEpStake(settingsStake);
  }

  const activeDeskProvider: ExchangeProvider | null =
    deskExchange === "default" ? null : deskExchange;

  const deskExchangeRow = useMemo(() => {
    const provider =
      activeDeskProvider ??
      (defaultExchange ? exchangeNameToProvider(defaultExchange.name) : null) ??
      "betfair";
    return (
      exchanges.find((e) => exchangeNameToProvider(e.name) === provider) ??
      defaultExchange ??
      exchanges[0] ??
      null
    );
  }, [activeDeskProvider, defaultExchange, exchanges]);

  const bookmakerColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of state?.balances?.accounts ?? []) {
      if (account.name && account.brandColor) map.set(account.name, account.brandColor);
    }
    return map;
  }, [state?.balances?.accounts]);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    // Soft whenever we already have a card - avoids full-page height jump on 60s polls.
    const soft = opts?.soft === true || (opts?.soft !== false && hasPayloadRef.current);
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const qs = new URLSearchParams({ date });
      if (activeDeskProvider) qs.set("exchange", activeDeskProvider);
      const path = `/api/racing/desk?${qs}`;
      // Hard mount uses apiGet so side-nav remounts reuse a warm payload.
      // Soft polls / manual refresh bypass the client cache for fresher lays;
      // theracingapi still serves racecards from its 15m server TTL.
      const res = soft
        ? await api<RacingDeskPayload>(path)
        : await apiGet<RacingDeskPayload>(path, DESK_GET_TTL_MS);
      hasPayloadRef.current = true;
      setPayload(res);
      setLoadedAt(Date.now());
      setSelectedId((prev) => {
        if (prev && res.races.some((r) => r.externalId === prev)) return prev;
        return res.races[0]?.externalId ?? null;
      });
    } catch (e) {
      toast.error("Could not load racing desk", { description: String(e) });
    } finally {
      if (soft) setRefreshing(false);
      else setLoading(false);
    }
  }, [date, activeDeskProvider]);

  // Adjust-during-render: a date switch blanks the card and re-enters loading.
  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    setPayload(null);
    setLoading(true);
  }

  useEffect(() => {
    hasPayloadRef.current = false;
    queueMicrotask(() => void load({ soft: false }));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps -- hard reload on date only

  useEffect(() => {
    if (!hasPayloadRef.current) return;
    queueMicrotask(() => void load({ soft: true }));
  }, [activeDeskProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => void load({ soft: true }), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const racingOfferKey = useMemo(
    () =>
      (state?.offers ?? [])
        .filter((o) => o.sport === "horse_racing" && (o.status === "active" || o.status === "planned"))
        .map((o) => `${o.id}:${o.status}`)
        .join("|"),
    [state?.offers]
  );
  useEffect(() => {
    if (!hasPayloadRef.current) return;
    void load({ soft: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racingOfferKey]);

  // Add bet tracks the race only on save; refresh desk Tracked badges when that lands.
  const trackedRacingKey = useMemo(
    () =>
      (state?.events ?? [])
        .filter((e) => e.sport === "horse_racing")
        .map((e) => e.id)
        .sort((a, b) => a - b)
        .join("|"),
    [state?.events]
  );
  useEffect(() => {
    if (!hasPayloadRef.current) return;
    void load({ soft: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedRacingKey]);

  function onDeskExchangeChange(value: string) {
    if (value === "default") {
      setDeskExchange("default");
      try {
        localStorage.removeItem(DESK_EXCHANGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (value === "betfair" || value === "betdaq" || value === "matchbook" || value === "smarkets") {
      setDeskExchange(value);
      try {
        localStorage.setItem(DESK_EXCHANGE_KEY, value);
      } catch {
        /* ignore */
      }
    }
  }
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  const selectRace = useCallback(
    (externalId: string) => {
      setSelectedId(externalId);
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("race") === externalId) return;
      params.set("race", externalId);
      router.replace(`/racing?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const clearRaceParam = useCallback(() => {
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("race")) return;
    params.delete("race");
    const qs = params.toString();
    router.replace(qs ? `/racing?${qs}` : "/racing", { scroll: false });
  }, [router, searchParams]);

  // Deep links from Campaigns (Edge today) and shared URLs.
  // Keep the active Qualifying/Recommended filter when the linked race still
  // belongs in it (course clicks update ?race= and must not reset the tab).
  // Adjust-during-render (react-hooks/set-state-in-effect): applied once per
  // raceParam, so later polls never re-assert the linked race.
  const [appliedRaceParam, setAppliedRaceParam] = useState<string | null>(null);
  if (!raceParam && appliedRaceParam !== null) setAppliedRaceParam(null);
  if (payload && raceParam && appliedRaceParam !== raceParam) {
    const race = payload.races.find((r) => r.externalId === raceParam);
    if (race) {
      setAppliedRaceParam(raceParam);
      setSelectedId(raceParam);
      setRaceFilter((current) => {
        if (current === "all") return current;
        if (current === "qualifying" && race.offerTags.some((t) => t.qualifies)) {
          return current;
        }
        if (
          current === "recommended" &&
          canOfferEdge &&
          (payload.edgePlays ?? []).some((p) => p.raceExternalId === raceParam)
        ) {
          return current;
        }
        return "all";
      });
    }
  }
  if (!canOfferEdge && raceFilter === "recommended") setRaceFilter("all");
  if (!canOfferEdge && intelligenceOpen) setIntelligenceOpen(false);

  const selected = useMemo(
    () => payload?.races.find((r) => r.externalId === selectedId) ?? null,
    [payload, selectedId]
  );

  // Adjust-during-render: place counts follow the selected race.
  const [prevSelectedRace, setPrevSelectedRace] = useState<{ id?: string; places?: number }>({});
  if (
    selected &&
    (prevSelectedRace.id !== selected.externalId ||
      prevSelectedRace.places !== selected.standardPlaces)
  ) {
    setPrevSelectedRace({ id: selected.externalId, places: selected.standardPlaces });
    setExchangePlaces(selected.standardPlaces);
    setBookiePlaces((prev) =>
      prev <= selected.standardPlaces ? Math.min(selected.standardPlaces + 1, 8) : prev
    );
  }

  const courses = useMemo(() => {
    const map = new Map<string, RacingDeskRace[]>();
    for (const race of payload?.races ?? []) {
      const list = map.get(race.course) ?? [];
      list.push(race);
      map.set(race.course, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [payload]);

  const edgePlays = canOfferEdge
    ? (payload?.edgePlays ?? EMPTY_EDGE_PLAYS)
    : EMPTY_EDGE_PLAYS;

  const qualifyingRaceTotal = useMemo(
    () =>
      courses.reduce(
        (n, [, races]) =>
          n + races.filter((r) => r.offerTags.some((t) => t.qualifies)).length,
        0
      ),
    [courses]
  );

  const racePicksTotal = useMemo(
    () => countRecommendedRaces(
      edgePlays,
      courses.flatMap(([, races]) => races)
    ),
    [courses, edgePlays]
  );

  const visibleCourses = useMemo(() => {
    if (raceFilter === "all") return courses;
    const recommendedIds =
      raceFilter === "recommended"
        ? new Set(edgePlays.map((p) => p.raceExternalId))
        : null;
    return courses
      .map(([course, races]) => {
        const filtered =
          raceFilter === "qualifying"
            ? races.filter((r) => r.offerTags.some((t) => t.qualifies))
            : races.filter((r) => recommendedIds!.has(r.externalId));
        return [course, filtered] as [string, RacingDeskRace[]];
      })
      .filter(([, races]) => races.length > 0);
  }, [courses, raceFilter, edgePlays]);

  /** Summary-tab filter on top of offer Qualifying / Edge pills. */
  const boardCourses = useMemo(() => {
    if (deskTab !== "tracked") return visibleCourses;
    return visibleCourses
      .map(
        ([course, races]) =>
          [course, races.filter((r) => r.trackedEventId != null)] as [
            string,
            RacingDeskRace[],
          ]
      )
      .filter(([, races]) => races.length > 0);
  }, [visibleCourses, deskTab]);

  const showRaceBoard =
    deskTab === "races" || deskTab === "tracked";
  const showActiveBets = deskTab === "active_bets";
  const showRacingPnl = deskTab === "pnl";

  // When a filter / summary tab hides the current race, land on the first
  // visible pick and keep ?race= in sync so the deep-link effect does not fight.
  useEffect(() => {
    if (!showRaceBoard) return;
    if (raceFilter === "all" && deskTab === "races") return;
    const visibleIds = new Set(
      boardCourses.flatMap(([, races]) => races.map((r) => r.externalId))
    );
    if (selectedId != null && visibleIds.has(selectedId)) return;
    queueMicrotask(() => {
      if (visibleIds.size === 0) {
        clearRaceParam();
        return;
      }
      const now = Date.now();
      for (const [, races] of boardCourses) {
        const next =
          races.find((r) => r.status === "live") ??
          races.find((r) => r.status === "upcoming" && r.startTime > now) ??
          races.find((r) => r.status === "upcoming") ??
          races[races.length - 1];
        if (next) {
          selectRace(next.externalId);
          return;
        }
      }
    });
  }, [
    raceFilter,
    deskTab,
    showRaceBoard,
    boardCourses,
    selectedId,
    selectRace,
    clearRaceParam,
  ]);

  async function trackRace(race: RacingDeskRace) {
    try {
      const res = await api<{ event: { id: number }; existing?: boolean }>("/api/events", {
        method: "POST",
        json: {
          sport: "horse_racing",
          homeTeam: race.raceName,
          awayTeam: race.offTime,
          competition: race.course,
          startTime: race.startTime,
          source: "api",
          externalId: race.externalId,
          status: race.status,
          runners: race.runners.map((r) => r.name),
          raceMeta: {
            type: race.type,
            distance: race.distance,
            raceClass: race.raceClass,
            prize: race.prize,
            going: race.going,
            fieldSize: race.fieldSize,
          },
        },
      });
      await api(`/api/racing/sync-results?eventId=${res.event.id}`, { method: "POST" });
      toast.success(res.existing ? "Already tracked" : "Race tracked");
      await load();
      return res.event.id;
    } catch (e) {
      toast.error("Could not track race", { description: String(e) });
      return null;
    }
  }

  async function untrackRace(race: RacingDeskRace) {
    if (race.trackedEventId == null) return;
    try {
      await api(`/api/events/${race.trackedEventId}`, { method: "DELETE" });
      toast.success("Race untracked");
      await load({ soft: true });
    } catch (e) {
      toast.error("Could not untrack race", { description: String(e) });
    }
  }

  function openBetForRunner(
    race: RacingDeskRace,
    runnerName: string,
    mode: "win" | "each_way" | "extra_place" | "place_refund" | "lay",
    offerId?: number
  ) {
    const runner = race.runners.find((r) => r.name === runnerName);
    const offerTag = findOfferTag(race, offerId);
    const fieldSize = race.fieldSize ?? race.runners.filter((r) => !r.nonRunner).length;
    const terms = ukPlaceTerms(fieldSize, {
      type: race.type,
      raceName: race.raceName,
    });
    const raceExchangePlaces =
      race.standardPlaces ?? (terms.places || placePositions(fieldSize));
    // Desk settings are the bookie EP offer; exchange places prefer the race ladder.
    const raceBookiePlaces = Math.max(bookiePlaces, raceExchangePlaces);
    const placeFraction =
      placeFractionOverride ?? terms.placeFraction ?? (fieldSize <= 7 ? 0.25 : 0.2);
    const { winOdds, layWinOdds, layPlaceOdds } = deskRunnerLayPrices(
      runner ?? {},
      placeFraction
    );

    if (mode === "lay") {
      openMatchedCalculator({
        mode: "qualifying",
        bookmaker: bookmakerFromOfferPrefs(
          offerBetPrefs,
          offerTag?.offerId,
          offerTag?.bookmaker
        ) || undefined,
        backStake: stakeFromOfferPrefs(
          offerBetPrefs,
          offerTag?.offerId,
          offerTag?.betStake,
          epStake
        ),
        backOdds: winOdds,
        layOdds: layWinOdds,
        exchangeId: deskExchangeRow?.id,
        commission: deskExchangeRow?.commissionPct,
      });
      return;
    }

    // Do not track yet. Add bet materialises the event only when the bet is saved
    // (pending fixture via raceExternalId, or existing trackedEventId).
    const raceLink = {
      ...(race.trackedEventId != null ? { eventId: race.trackedEventId } : {}),
      raceExternalId: race.externalId,
      raceEventDate: date,
    };
    // Seed Selection options from the desk row's card so the horse is visible
    // before /api/racing/runners returns.
    const deskRunners = race.runners
      .filter((r) => !r.nonRunner && r.name.trim())
      .map((r) => r.name);

    if (mode === "place_refund") {
      if (!offerTag) {
        toast.error("No qualifying offer for this race");
        return;
      }
      openAddBet({
        sport: "horse_racing",
        market: "win",
        selection: runnerName,
        runners: deskRunners,
        homeTeam: race.raceName,
        awayTeam: race.offTime,
        ...raceLink,
        layOdds: layWinOdds,
        exchangeId: deskExchangeRow?.id,
        backStake: stakeFromOfferPrefs(
          offerBetPrefs,
          offerTag.offerId,
          offerTag.betStake,
          epStake
        ),
        bookmaker:
          bookmakerFromOfferPrefs(offerBetPrefs, offerTag.offerId, offerTag.bookmaker) ||
          undefined,
        offerId: offerTag.offerId,
        triggerText: offerTag.triggerText,
        labelSuggestion: `${race.course} · ${runnerName} · ${offerTag.offerTitle}`,
      });
      return;
    }

    if (mode === "each_way" || mode === "extra_place") {
      const epMode =
        mode === "extra_place" && raceBookiePlaces > raceExchangePlaces
          ? "extra_place"
          : mode === "extra_place"
            ? "each_way"
            : "each_way";
      if (mode === "extra_place" && epMode === "each_way") {
        toast.message("No extra place vs exchange", {
          description: "Opening standard each-way. Raise bookie places in Settings if the offer pays more.",
        });
      }
      openEachWayCalculator({
        mode: epMode,
        selection: runnerName,
        stakePerPart: epStake,
        winOdds,
        layWinOdds,
        layPlaceOdds,
        placeFraction,
        fieldSize,
        bookiePlaces: epMode === "extra_place" ? raceBookiePlaces : raceExchangePlaces,
        exchangePlaces: raceExchangePlaces,
        commission: deskExchangeRow?.commissionPct,
        exchangeId: deskExchangeRow?.id,
        homeTeam: race.raceName,
        awayTeam: race.offTime,
        ...raceLink,
        labelSuggestion:
          epMode === "extra_place"
            ? `${race.course} · ${runnerName} EP ${raceBookiePlaces}p`
            : `${race.course} · ${runnerName} EW`,
      });
      return;
    }

    openAddBet({
      sport: "horse_racing",
      market: "win",
      selection: runnerName,
      runners: deskRunners,
      homeTeam: race.raceName,
      awayTeam: race.offTime,
      ...raceLink,
      layOdds: layWinOdds,
      exchangeId: deskExchangeRow?.id,
      backStake: epStake,
      labelSuggestion: `${race.course} · ${runnerName}`,
    });
  }

  const summary = payload?.summary;
  const suggestions = canOfferEdge ? (payload?.suggestedRaces ?? []) : [];
  const topSuggestion = suggestions.reduce<(typeof suggestions)[number] | undefined>(
    (best, s) => (s.topEv != null && (best?.topEv == null || s.topEv > best.topEv) ? s : best),
    undefined
  );

  const refreshLabel = useMemo(() => {
    if (loadedAt == null) return undefined;
    const secs = Math.max(0, Math.round((nowTick - loadedAt) / 1000));
    if (secs < 5) return "Updated just now";
    if (secs < 60) return `Updated ${secs}s ago`;
    return `Updated ${Math.floor(secs / 60)}m ago`;
  }, [loadedAt, nowTick]);

  const exchangeStatusLabel = useMemo(() => {
    if (!summary) return undefined;
    if (summary.exchangeStatus === "connected") {
      const delay = summary.exchangeFeedType === "delayed" ? "delayed" : "live";
      return `${summary.exchangeName ?? "Exchange"} ${delay}`;
    }
    if (summary.exchangeStatus === "not_configured") return "No exchange feed";
    return summary.exchangeNote ? "Exchange unmatched" : undefined;
  }, [summary]);

  const pendingSettleRaces = useMemo(
    () => (payload?.races ?? []).filter(isDeskRacePendingSettle).map(deskRaceToPendingSettle),
    [payload?.races]
  );

  // Match home: hold the desk until the first racecard payload lands.
  if (loading && payload == null) {
    return (
      <PageShell fullHeight>
        <div
          className="flex min-h-[var(--layout-page-min-h)] flex-1 flex-col items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Loading racing desk"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        helpId="racing"
        title="Racing Desk"
        description="UK & IRE racecards with live exchange lays."
        action={
          <>
            {canOfferEdge ? (
              <RacingIntelligenceTrigger
                count={suggestions.length}
                topEv={topSuggestion?.topEv}
                onClick={() => setIntelligenceOpen(true)}
                demo={summary?.source === "demo"}
              />
            ) : null}
            {(payload?.activeOffers.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/offers")}
              >
                <ExternalLink className="size-4" />
                Offers
              </Button>
            )}
            <DatePicker
              value={date}
              onChange={setDate}
              size="lg"
              className="w-40 shrink-0"
            />
            <Button
              variant="outline"
              size="icon-lg"
              onClick={() => void load({ soft: !!payload })}
              disabled={loading || refreshing}
            >
              <RefreshCw className={cn("size-4", (loading || refreshing) && "animate-spin")} />
            </Button>
          </>
        }
      />

      <RacingIntelligenceDialog
        open={intelligenceOpen}
        onOpenChange={setIntelligenceOpen}
        suggestions={suggestions}
        onSelectRace={selectRace}
        onBackRunner={(raceId, runnerName, offerId) => {
          selectRace(raceId);
          const race = payload?.races.find((r) => r.externalId === raceId);
          if (race) openBetForRunner(race, runnerName, "place_refund", offerId);
        }}
        onViewOffer={(offerId) => {
          const offer = (state?.offers ?? []).find((o) => o.id === offerId);
          if (offer) viewOffer(offer);
        }}
        hasPlaceRefundOffer={(payload?.activeOffers.length ?? 0) > 0}
        dateLabel={new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
        dataSource={summary?.source}
      />

      {pendingSettleRaces.length > 0 && (
        <RacingSettlePrompt
          races={pendingSettleRaces}
          resultsTier={summary?.resultsTier}
        />
      )}

      {summary && (
        <StatStrip columns={4}>
          <StatTile
            label="Races"
            value={String(summary.raceCount)}
            sub={`${summary.upcomingCount} upcoming`}
            active={deskTab === "races"}
            onClick={() => setDeskTab("races")}
          />
          <StatTile
            label="Tracked"
            value={String(summary.trackedCount)}
            active={deskTab === "tracked"}
            onClick={() => setDeskTab("tracked")}
          />
          <StatTile
            label="Active bets"
            value={String(summary.openPositions)}
            active={deskTab === "active_bets"}
            onClick={() => setDeskTab("active_bets")}
          />
          <StatTile
            label="Racing P&L today"
            value={<MoneyFlow value={summary.racingPnlToday} signColor />}
            sub={racingPnlTileSub(
              payload?.racingPnlDay.settledCount ?? 0,
              payload?.racingPnlDay.openCount ?? 0
            )}
            active={deskTab === "pnl"}
            onClick={() => setDeskTab("pnl")}
          />
        </StatStrip>
      )}

      {showActiveBets && (
        <ActiveBetsStrip
          bets={payload?.activeBets ?? []}
          onSelectRace={(id) => {
            setDeskTab("races");
            setSelectedId(id);
            setRaceFilter("all");
          }}
          onBrowseRaces={() => {
            setDeskTab("races");
            setRaceFilter("all");
          }}
        />
      )}

      {showRacingPnl && (
        <RacingPnlTodayView
          report={payload?.racingPnlDay}
          dateLabel={new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          onSelectRace={(id) => {
            setDeskTab("races");
            setSelectedId(id);
            setRaceFilter("all");
          }}
        />
      )}

      {payload?.error && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          API note: {payload.error} - showing fallback data.
        </p>
      )}

      {showRaceBoard && !loading && (payload?.races.length ?? 0) === 0 && (
        <EmptyState
          icon={Trophy}
          title={summary?.source === "demo" ? "Demo racecards" : "No races for this date"}
          description={
            summary?.source === "demo"
              ? "Sample racecards until the racing feed is connected. Add an active place-refund offer to see Intelligence in action."
              : "Try today's date, or add a place-refund offer to put the desk to work."
          }
          action={{
            label: "Add racing offer",
            onClick: () => openOffer({ category: "horse_racing", eventDate: date }),
          }}
          secondaryAction={{ label: "Racing Desk guide", href: "/help?guide=racing-desk" }}
        />
      )}

      <RacingDeskSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        epStake={epStake}
        onEpStakeChange={setEpStake}
        bookiePlaces={bookiePlaces}
        onBookiePlacesChange={setBookiePlaces}
        exchangePlaces={exchangePlaces}
        onExchangePlacesChange={setExchangePlaces}
        placeFraction={placeFractionOverride}
        onPlaceFractionChange={(v) => {
          setPlaceFractionOverride(v);
          try {
            if (v == null) localStorage.removeItem(DESK_PLACE_FRACTION_KEY);
            else localStorage.setItem(DESK_PLACE_FRACTION_KEY, String(v));
          } catch {
            /* ignore */
          }
        }}
        deskExchange={deskExchange}
        onDeskExchangeChange={onDeskExchangeChange}
        defaultExchangeName={defaultExchange?.name}
        exchanges={exchanges.map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault === 1,
        }))}
        exchangeNameToProvider={exchangeNameToProvider}
        showOfferGuide={showOfferGuide}
        onShowOfferGuideChange={setShowOfferGuide}
      />

      {showRaceBoard && (
        <Card className={cn(deskCardShell, "min-w-0 gap-0 py-0")}>
          <DeskFilterPills
            embedded
            filter={raceFilter}
            onFilterChange={setRaceFilter}
            onSettingsClick={() => setSettingsOpen(true)}
            qualifyingCount={qualifyingRaceTotal}
            racePicksCount={racePicksTotal}
            showRacePicks={canOfferEdge}
          />
          <div className="bg-selection-subtle/50">
          <CardHeader className="gap-0 pt-4 pb-0">
            <CardTitle section className="flex items-center gap-1.5 text-lg">
              Courses
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Courses legend"
                      >
                        <HelpCircle className="size-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="gap-2 py-2">
                      {canOfferEdge ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Zap className="size-3.5 shrink-0 text-edge" aria-hidden />
                          Edge (on course tabs in Qualifying)
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full bg-background/45"
                          aria-hidden
                        />
                        Near min runners
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription compact>
                {boardCourses.length} meeting{boardCourses.length === 1 ? "" : "s"}
                {deskTab === "tracked" ? " · tracked" : ""}
                {raceFilter === "qualifying"
                  ? " · qualifying"
                  : raceFilter === "recommended"
                    ? " · recommended"
                    : ""}
                {(payload?.activeOffers.length ?? 0) > 0
                  ? ` · ${payload!.activeOffers.length} active offer${
                      payload!.activeOffers.length === 1 ? "" : "s"
                    }`
                  : ""}
              </CardDescription>
              <CardAction>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => openOffer({ category: "horse_racing", eventDate: date })}
                >
                  <Plus className="size-3.5" />
                  Add racing offer
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="min-w-0 px-0 pb-0 pt-5">
              {boardCourses.length === 0 ? (
                <div className="px-(--card-spacing) pb-4">
                  <EmptyState
                    compact
                    icon={Trophy}
                    title={
                      deskTab === "tracked"
                        ? "No tracked races"
                        : raceFilter === "recommended"
                          ? "No recommended races today"
                          : raceFilter === "qualifying"
                            ? "No qualifying races today"
                            : "No meetings for this date"
                    }
                    description={
                      deskTab === "tracked"
                        ? "Track a race from the board and it will sit here."
                        : raceFilter === "recommended"
                          ? "Offer Edge has no modelled plays for this date."
                          : raceFilter === "qualifying"
                            ? "None of today's meetings match your open offers."
                            : "Try another date, or refresh the desk in a moment."
                    }
                    className="shadow-none"
                  />
                </div>
              ) : (
                <Tabs
                  value={selected?.course ?? boardCourses[0]?.[0] ?? ""}
                  onValueChange={(course) => {
                    const races = boardCourses.find(([c]) => c === course)?.[1] ?? [];
                    const now = Date.now();
                    const nextRace =
                      races.find((r) => r.status === "live") ??
                      races.find((r) => r.status === "upcoming" && r.startTime > now) ??
                      races.find((r) => r.status === "upcoming") ??
                      races[races.length - 1];
                    if (nextRace) selectRace(nextRace.externalId);
                    else setSelectedId(null);
                  }}
                  className="gap-0"
                >
                  {/* No card bleed — CardContent is already px-0; pad via TabsList. */}
                  <TabsLineBar className="border-b-0">
                    <TabsList
                      variant="line"
                      className="justify-start"
                      fadeClassName="from-selection-subtle/50"
                    >
                      {boardCourses.map(([course, races]) => {
                        const region = races[0]?.region;
                        // All races: no counters. Qualifying/Race picks: race
                        // count only; qualify totals live on the filter pills.
                        // Edge badges stay in Qualifying so picks still stand out.
                        const showCounters = raceFilter !== "all";
                        const recommendedRaceCount =
                          raceFilter === "qualifying"
                            ? countRecommendedRaces(edgePlays, races)
                            : 0;
                        return (
                          <TabsTrigger
                            key={course}
                            value={course}
                            className="gap-1.5"
                          >
                            <RegionFlag code={region} />
                            <span className="truncate">{course}</span>
                            {showCounters && (
                              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                {races.length}
                                {recommendedRaceCount > 0 && (
                                  <span
                                    className={edgeMarkerPill}
                                    title={`${recommendedRaceCount} recommended race${recommendedRaceCount === 1 ? "" : "s"} (Offer Edge)`}
                                  >
                                    <Zap className="size-3" aria-hidden />
                                    {recommendedRaceCount}
                                  </span>
                                )}
                              </span>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </TabsLineBar>
                </Tabs>
              )}
            </CardContent>
          </div>

          <DeskRacecard
            embedded
            courses={boardCourses}
            selected={selected}
            selectedId={selectedId}
            onSelectRace={selectRace}
            bookiePlaces={bookiePlaces}
            exchangePlaces={exchangePlaces}
            onTrack={trackRace}
            onUntrack={untrackRace}
            onBet={openBetForRunner}
            layColor={summary?.layColor ?? deskExchangeRow?.layColor}
            advancedMode={advancedMode}
            onAdvancedModeChange={setAdvancedMode}
            showOfferGuide={showOfferGuide}
            refreshLabel={refreshLabel}
            refreshing={refreshing}
            exchangeStatusLabel={exchangeStatusLabel}
            bookmakerColors={bookmakerColors}
            edgePlays={edgePlays}
            showEdgeTabCounters={raceFilter === "qualifying"}
            defaultGuideExpanded={raceFilter !== "all"}
            dataSource={summary?.source}
          />
        </Card>
      )}
    </PageShell>
  );
}
