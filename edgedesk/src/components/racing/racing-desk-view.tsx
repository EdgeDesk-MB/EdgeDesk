"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyFlow } from "@/components/money-flow";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { FlashscoreRacecard } from "@/components/racing/flashscore-racecard";
import {
  DeskFilterPills,
  RacingIntelligenceDialog,
  RacingIntelligenceTrigger,
  type DeskRaceFilter,
} from "@/components/racing/racing-intelligence-dialog";
import { RacingSettlePrompt } from "@/components/racing/racing-settle-prompt";
import { useAddBet } from "@/components/add-bet-provider";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { VenueBadge } from "@/components/venue-badge";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  formatOfferScopeLabel,
} from "@/lib/offers/racing-offer-rules";
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
import { extraPlace } from "@/lib/calc";
import { serializeEwMeta } from "@/lib/bets/ew-meta";
import {
  Calculator,
  ExternalLink,
  Plus,
  RefreshCw,
  Tag,
  Sparkles,
  Trophy,
} from "lucide-react";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { RegionFlag } from "@/components/region-flag";
import { cn } from "@/lib/utils";
import { edgeMarkerPill, listRowSelected } from "@/lib/ui/surface-styles";
import {
  deskRaceToPendingSettle,
  isDeskRacePendingSettle,
} from "@/lib/racing/pending-settle";

const DESK_EXCHANGE_KEY = "edgedesk:racing-desk-exchange";
const EMPTY_EDGE_PLAYS: NonNullable<RacingDeskPayload["edgePlays"]> = [];

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
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer, viewOffer } = useOfferDialog();
  const { defaultExchange, exchanges } = useExchanges();
  const { state } = useAppState();
  const offerBetPrefs = state?.settings?.offerBetPrefs ?? {};
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<RacingDeskPayload | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  /** True only on first load - soft polls must not blank the page. */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hasPayloadRef = useRef(false);
  // Courses is a horizontal pill row below `xl`, a vertical list above it -
  // drag-to-pan only matters in the pill layout (no-op once it's vertical,
  // since there's nothing to scroll horizontally there).
  const coursesScrollRef = useRef<HTMLDivElement>(null);
  const coursesDrag = useDragToScroll(coursesScrollRef);
  const [bookiePlaces, setBookiePlaces] = useState(4);
  const [exchangePlaces, setExchangePlaces] = useState(3);
  const [epStake, setEpStake] = useState(10);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [raceFilter, setRaceFilter] = useState<DeskRaceFilter>("all");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [deskExchange, setDeskExchange] = useState<ExchangeProvider | "default">("default");

  useEffect(() => {
    // localStorage is client-only; defer a microtask past hydration.
    queueMicrotask(() => {
      const stored = readDeskExchangeOverride();
      if (stored) setDeskExchange(stored);
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
      const res = await api<RacingDeskPayload>(`/api/racing/desk?${qs}`);
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
  const saveOddsOverride = useCallback(
    async (raceId: string, horseId: string, bookieDecimal: number | null) => {
      try {
        if (bookieDecimal == null) {
          await api(
            `/api/racing/overrides?raceId=${encodeURIComponent(raceId)}&horseId=${encodeURIComponent(horseId)}`,
            { method: "DELETE" }
          );
          toast.success("Cleared manual odds");
        } else {
          await api("/api/racing/overrides", {
            method: "POST",
            json: { raceId, horseId, bookieDecimal },
          });
          toast.success("Saved bookie odds");
        }
        await load({ soft: true });
      } catch (e) {
        toast.error("Could not save odds", { description: String(e) });
      }
    },
    [load]
  );

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

  // Deep links from Campaigns ("Best plays today") and shared URLs.
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
          (payload.edgePlays ?? []).some((p) => p.raceExternalId === raceParam)
        ) {
          return current;
        }
        return "all";
      });
    }
  }

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

  const edgePlays = payload?.edgePlays ?? EMPTY_EDGE_PLAYS;

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

  // When the filter hides the current race, land on the first visible pick
  // and keep ?race= in sync so the deep-link effect does not fight the tab.
  useEffect(() => {
    if (raceFilter === "all") return;
    const visibleIds = new Set(
      visibleCourses.flatMap(([, races]) => races.map((r) => r.externalId))
    );
    if (selectedId != null && visibleIds.has(selectedId)) return;
    queueMicrotask(() => {
      if (visibleIds.size === 0) {
        clearRaceParam();
        return;
      }
      const now = Date.now();
      for (const [, races] of visibleCourses) {
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
  }, [raceFilter, visibleCourses, selectedId, selectRace, clearRaceParam]);

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

  async function openBetForRunner(
    race: RacingDeskRace,
    runnerName: string,
    mode: "win" | "extra_place" | "place_refund" | "lay",
    offerId?: number
  ) {
    const runner = race.runners.find((r) => r.name === runnerName);
    const winOdds = runner?.bookieDecimal ?? runner?.spDecimal ?? 8;
    const layOdds = runner?.exchangeDecimal ?? winOdds * 1.03;
    const offerTag = findOfferTag(race, offerId);

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
        layOdds,
        exchangeId: deskExchangeRow?.id,
        commission: deskExchangeRow?.commissionPct,
      });
      return;
    }

    let eventId = race.trackedEventId;
    if (!eventId) {
      eventId = (await trackRace(race)) ?? undefined;
    }

    if (mode === "place_refund") {
      if (!offerTag) {
        toast.error("No qualifying offer for this race");
        return;
      }
      openAddBet({
        sport: "horse_racing",
        market: "win",
        selection: runnerName,
        homeTeam: race.raceName,
        awayTeam: race.offTime,
        eventId,
        backOdds: winOdds,
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

    if (mode === "extra_place" && bookiePlaces > exchangePlaces) {
      const ep = extraPlace({
        stakePerPart: epStake,
        winOdds,
        placeFraction: 0.2,
        layWinOdds: layOdds,
        layPlaceOdds: 2.8,
        commission: 0.02,
        bookiePlaces,
        exchangePlaces,
      });
      openAddBet({
        sport: "horse_racing",
        market: "extra_place",
        selection: runnerName,
        homeTeam: race.raceName,
        awayTeam: race.offTime,
        eventId,
        backStake: epStake * 2,
        backOdds: winOdds,
        layOdds: layOdds,
        layStake: ep.layWinStake + ep.layPlaceStake,
        expectedProfit: ep.worstCase,
        labelSuggestion: `${race.course} · ${runnerName} EP ${bookiePlaces}p`,
        notes: serializeEwMeta({
          stakePerPart: epStake,
          placeFraction: 0.2,
          layWin: { stake: ep.layWinStake, odds: layOdds },
          layPlace: { stake: ep.layPlaceStake, odds: 2.8 },
          bookiePlaces,
          exchangePlaces,
          mode: "extra_place",
        }),
      });
      return;
    }

    openAddBet({
      sport: "horse_racing",
      market: "win",
      selection: runnerName,
      homeTeam: race.raceName,
      awayTeam: race.offTime,
      eventId,
      backOdds: winOdds,
      backStake: epStake,
      labelSuggestion: `${race.course} · ${runnerName}`,
    });
  }

  const summary = payload?.summary;
  const suggestions = payload?.suggestedRaces ?? [];
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

  return (
    <PageShell>
      <PageHeader
        helpId="racing"
        title="Racing Desk"
        description="UK & IRE racecards with live exchange lays."
        action={
          <>
            <RacingIntelligenceTrigger
              count={suggestions.length}
              topEv={topSuggestion?.topEv}
              topEvConfidence={topSuggestion?.confidence}
              dataSource={payload?.summary.source}
              onClick={() => setIntelligenceOpen(true)}
            />
            {(payload?.activeOffers.length ?? 0) > 0 && (
              <Button variant="outline" {...pageSecondaryButtonProps} asChild>
                <Link href="/offers">
                  <ExternalLink className="size-4" />
                  Offers
                </Link>
              </Button>
            )}
            <DatePicker
              value={date}
              onChange={setDate}
              className="h-9 w-40"
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
          if (race) void openBetForRunner(race, runnerName, "place_refund", offerId);
        }}
        onViewOffer={(offerId) => {
          const offer = (state?.offers ?? []).find((o) => o.id === offerId);
          if (offer) viewOffer(offer);
        }}
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
        <StatStrip columns={5}>
          <StatTile label="Races" value={String(summary.raceCount)} sub={`${summary.upcomingCount} upcoming`} />
          <StatTile label="Live / off" value={String(summary.liveCount)} />
          <StatTile label="Tracked" value={String(summary.trackedCount)} />
          <StatTile label="Open positions" value={String(summary.openPositions)} />
          <StatTile
            label="Racing P&L today"
            value={<MoneyFlow value={summary.racingPnlToday} signColor />}
            sub={
              summary.openPositions > 0
                ? "By race day · open at worst case"
                : "By race day"
            }
          />
        </StatStrip>
      )}

      {payload?.error && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          API note: {payload.error} - showing fallback data.
        </p>
      )}

      {!loading && (payload?.races.length ?? 0) === 0 && (
        <EmptyState
          icon={Trophy}
          title={summary?.source === "demo" ? "Demo racecards" : "No races for this date"}
          description={
            summary?.source === "demo"
              ? "Add Racing API credentials in .env.local for real UK & IRE racecards, or add an active place-refund offer to see Intelligence in action."
              : "Try today's date, check your Racing API key in Settings, or add a place-refund offer."
          }
          action={{
            label: "Add racing offer",
            onClick: () => openOffer({ category: "horse_racing", eventDate: date }),
          }}
          secondaryAction={{ label: "Racing Desk guide", href: "/help?guide=racing-desk" }}
        />
      )}

      <DeskFilterPills
        filter={raceFilter}
        onFilterChange={setRaceFilter}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <aside className="flex min-w-0 flex-col gap-3 xl:col-span-3">
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle section>Courses</CardTitle>
              <CardDescription compact>
                {visibleCourses.length} meeting{visibleCourses.length === 1 ? "" : "s"}
                {raceFilter === "qualifying"
                  ? " · qualifying"
                  : raceFilter === "recommended"
                    ? " · recommended"
                    : ""}
              </CardDescription>
            </CardHeader>
            <CardContent
              ref={coursesScrollRef}
              className={cn(
                "app-scroll-nested min-w-0 flex cursor-grab gap-1.5 overflow-x-auto pb-1 active:cursor-grabbing",
                "xl:max-h-[22rem] xl:cursor-default xl:flex-col xl:gap-0 xl:space-y-0.5 xl:overflow-x-hidden xl:overflow-y-auto xl:pb-0 xl:active:cursor-default"
              )}
              onPointerDown={coursesDrag.onPointerDown}
              onPointerMove={coursesDrag.onPointerMove}
              onPointerUp={coursesDrag.onPointerUp}
              onPointerCancel={coursesDrag.onPointerCancel}
              onClickCapture={coursesDrag.onClickCapture}
            >
              {visibleCourses.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {raceFilter === "recommended"
                    ? "No recommended races today - Offer Edge has no modelled plays."
                    : raceFilter === "qualifying"
                      ? "No qualifying races for your offers today."
                      : "No meetings for this date."}
                </p>
              )}
              {visibleCourses.map(([course, races]) => {
                const active = selected?.course === course;
                const region = races[0]?.region;
                const qualifyingRaceCount = races.filter((r) =>
                  r.offerTags.some((t) => t.qualifies)
                ).length;
                const recommendedRaceCount = countRecommendedRaces(edgePlays, races);
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => {
                      const now = Date.now();
                      const nextRace =
                        races.find((r) => r.status === "live") ??
                        races.find((r) => r.status === "upcoming" && r.startTime > now) ??
                        races.find((r) => r.status === "upcoming") ??
                        races[races.length - 1];
                      if (nextRace) selectRace(nextRace.externalId);
                      else setSelectedId(null);
                    }}
                    className={cn(
                      listRowSelected(active),
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-left text-sm",
                      "xl:w-full xl:shrink xl:justify-between xl:whitespace-normal xl:rounded-md xl:px-2.5 xl:py-2"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                      <RegionFlag code={region} />
                      <span className="truncate">{course}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {races.length}
                      {qualifyingRaceCount > 0 && (
                        <span
                          className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-success/15 px-1 text-[9px] font-bold tabular-nums text-success"
                          title={`${qualifyingRaceCount} qualifying race${qualifyingRaceCount === 1 ? "" : "s"}`}
                        >
                          {qualifyingRaceCount}
                        </span>
                      )}
                      {recommendedRaceCount > 0 && (
                        <span
                          className={edgeMarkerPill}
                          title={`${recommendedRaceCount} recommended race${recommendedRaceCount === 1 ? "" : "s"} (Offer Edge)`}
                        >
                          <Sparkles className="size-2" aria-hidden />
                          {recommendedRaceCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </CardContent>
            <div className="space-y-1.5 border-t border-border/60 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Legend
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground xl:flex-col xl:gap-y-1">
                <li className="flex items-center gap-1.5">
                  <span className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-success/15 px-1 text-[9px] font-bold tabular-nums text-success">
                    n
                  </span>
                  Qualifies for an offer
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="inline-flex min-w-[1rem] items-center justify-center gap-0.5 rounded-full bg-edge/20 px-1 text-[9px] font-bold tabular-nums text-edge">
                    <Sparkles className="size-2" aria-hidden />
                    n
                  </span>
                  Recommended (modelled EV)
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
                    aria-hidden
                  />
                  Near minimum runners
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle section className="flex items-center gap-2">
                <Tag className="size-3.5" />
                Offers
              </CardTitle>
              <CardDescription compact>
                {(payload?.activeOffers.length ?? 0) > 0
                  ? `${payload!.activeOffers.length} active for ${date}`
                  : `None active for ${date}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(payload?.activeOffers ?? []).map((offer) => {
                const offerSummary = (state?.offers ?? []).find((o) => o.id === offer.id);
                return (
                  <button
                    key={offer.id}
                    type="button"
                    className="w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-selection-subtle"
                    onClick={() => offerSummary && viewOffer(offerSummary)}
                  >
                    <p className="font-medium leading-snug">{offer.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      {offer.bookmaker ? (
                        <VenueBadge name={offer.bookmaker} />
                      ) : (
                        <span>Any bookie</span>
                      )}
                      <span>·</span>
                      <span>{formatOfferScopeLabel(offer.scopeCourse, offer.scopeRaceLabel)}</span>
                    </div>
                  </button>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-1.5"
                onClick={() => openOffer({ category: "horse_racing", eventDate: date })}
              >
                <Plus className="size-3.5" />
                Add racing offer
              </Button>
            </CardContent>
          </Card>

          {advancedMode && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle section>Extra place</CardTitle>
                <CardDescription compact>Quick EP when adding bets from the racecard.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Stake
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={epStake}
                      onChange={(e) => setEpStake(parseFloat(e.target.value) || 10)}
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Bookie
                    </Label>
                    <Input
                      type="number"
                      min={2}
                      max={8}
                      value={bookiePlaces}
                      onChange={(e) => setBookiePlaces(parseInt(e.target.value, 10) || 4)}
                      className="h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Exch.
                    </Label>
                    <Input
                      type="number"
                      min={2}
                      max={8}
                      value={exchangePlaces}
                      onChange={(e) => setExchangePlaces(parseInt(e.target.value, 10) || 3)}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  {bookiePlaces > exchangePlaces ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      EP zone: {exchangePlaces + 1}–{bookiePlaces}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Bookie places &gt; exchange</span>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                    <Link href="/calculators/each-way">
                      <Calculator className="size-3.5" />
                      Calc
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>

        <div className="min-w-0 xl:col-span-9">
          <FlashscoreRacecard
            courses={visibleCourses}
            selected={selected}
            selectedId={selectedId}
            onSelectRace={selectRace}
            bookiePlaces={bookiePlaces}
            exchangePlaces={exchangePlaces}
            onTrack={trackRace}
            onUntrack={untrackRace}
            onBet={openBetForRunner}
            onOddsOverride={saveOddsOverride}
            backColor={summary?.backColor ?? deskExchangeRow?.backColor}
            layColor={summary?.layColor ?? deskExchangeRow?.layColor}
            advancedMode={advancedMode}
            refreshLabel={refreshLabel}
            refreshing={refreshing}
            exchangeStatusLabel={exchangeStatusLabel}
            bookmakerColors={bookmakerColors}
            edgePlays={edgePlays}
            dataSource={summary?.source}
            exchangeControl={
              <div className="flex items-center gap-1.5">
                <Label htmlFor="desk-exchange" className="sr-only">
                  Desk exchange
                </Label>
                <Select value={deskExchange} onValueChange={onDeskExchangeChange}>
                  <SelectTrigger id="desk-exchange" size="sm" className="h-7 w-28">
                    <SelectValue placeholder="Exchange" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Default
                      {defaultExchange ? ` (${defaultExchange.name})` : ""}
                    </SelectItem>
                    {exchanges.map((ex) => {
                      const provider = exchangeNameToProvider(ex.name);
                      if (!provider) return null;
                      return (
                        <SelectItem key={ex.id} value={provider}>
                          {ex.name}
                          {ex.isDefault ? " · app default" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        </div>
      </div>
    </PageShell>
  );
}
