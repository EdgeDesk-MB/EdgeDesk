"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/racing/racing-intelligence-dialog";
import { RacingSettlePrompt } from "@/components/racing/racing-settle-prompt";
import { useAddBet } from "@/components/add-bet-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { VenueBadge } from "@/components/venue-badge";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  formatOfferScopeLabel,
} from "@/lib/offers/racing-offer-rules";
import { findOfferTag } from "@/lib/racing/offer-tags";
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
  Trophy,
} from "lucide-react";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { RegionFlag } from "@/components/region-flag";
import { cn } from "@/lib/utils";
import { listRowSelected } from "@/lib/ui/surface-styles";
import {
  deskRaceToPendingSettle,
  isDeskRacePendingSettle,
} from "@/lib/racing/pending-settle";

const DESK_EXCHANGE_KEY = "edgedesk:racing-desk-exchange";

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
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer } = useOfferDialog();
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
  const [bookiePlaces, setBookiePlaces] = useState(4);
  const [exchangePlaces, setExchangePlaces] = useState(3);
  const [epStake, setEpStake] = useState(10);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [qualifyingOnly, setQualifyingOnly] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [deskExchange, setDeskExchange] = useState<ExchangeProvider | "default">("default");

  useEffect(() => {
    const stored = readDeskExchangeOverride();
    if (stored) setDeskExchange(stored);
  }, []);

  useEffect(() => {
    const def = state?.settings?.defaultBackStake;
    if (def != null && def > 0) setEpStake(def);
  }, [state?.settings?.defaultBackStake]);

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

  const selected = useMemo(
    () => payload?.races.find((r) => r.externalId === selectedId) ?? null,
    [payload, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    setExchangePlaces(selected.standardPlaces);
    setBookiePlaces((prev) =>
      prev <= selected.standardPlaces ? Math.min(selected.standardPlaces + 1, 8) : prev
    );
  }, [selected?.externalId, selected?.standardPlaces]);

  const courses = useMemo(() => {
    const map = new Map<string, RacingDeskRace[]>();
    for (const race of payload?.races ?? []) {
      const list = map.get(race.course) ?? [];
      list.push(race);
      map.set(race.course, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [payload]);

  const visibleCourses = useMemo(() => {
    if (!qualifyingOnly) return courses;
    return courses
      .map(([course, races]) => {
        const filtered = races.filter((r) => r.offerTags.some((t) => t.qualifies));
        return [course, filtered] as [string, RacingDeskRace[]];
      })
      .filter(([, races]) => races.length > 0);
  }, [courses, qualifyingOnly]);

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
  const topSuggestionScore = suggestions[0]?.score;

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
              topScore={topSuggestionScore}
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
            <div className="flex items-center gap-1.5">
              <Label htmlFor="desk-exchange" className="sr-only">
                Desk exchange
              </Label>
              <Select
                value={deskExchange}
                onValueChange={onDeskExchangeChange}
              >
                <SelectTrigger id="desk-exchange" size="sm" className="h-9 w-[9.5rem]">
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
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-36"
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
        onSelectRace={setSelectedId}
        onBackRunner={(raceId, runnerName, offerId) => {
          const race = payload?.races.find((r) => r.externalId === raceId);
          if (race) void openBetForRunner(race, runnerName, "place_refund", offerId);
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
            value={<MoneyFlow value={summary.racingPnlToday} />}
            sub={summary.source === "demo" ? "Demo data" : "Racing API"}
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
        qualifyingOnly={qualifyingOnly}
        onQualifyingOnlyChange={setQualifyingOnly}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
        trailing={
          <button
            type="button"
            onClick={() => openOffer({ category: "horse_racing", eventDate: date })}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Plus className="size-3" />
            Add racing offer
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <aside className="flex flex-col gap-3 lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle section>Courses</CardTitle>
              <CardDescription compact>
                {visibleCourses.length} meeting{visibleCourses.length === 1 ? "" : "s"}
                {qualifyingOnly ? " · qualifying" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="app-scroll-nested max-h-[22rem] space-y-0.5 overflow-y-auto">
              {visibleCourses.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No qualifying races for your offers today.
                </p>
              )}
              {visibleCourses.map(([course, races]) => {
                const active = selected?.course === course;
                const region = races[0]?.region;
                const qualifyingRaceCount = races.filter((r) =>
                  r.offerTags.some((t) => t.qualifies)
                ).length;
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => setSelectedId(races[0]?.externalId ?? null)}
                    className={cn(
                      "flex w-full items-center justify-between px-2.5 py-2 text-left text-sm",
                      listRowSelected(active)
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
                          className="inline-flex min-w-[1rem] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[9px] font-bold tabular-nums text-emerald-800 dark:text-emerald-300"
                          title={`${qualifyingRaceCount} race${qualifyingRaceCount === 1 ? "" : "s"} with offers`}
                        >
                          {qualifyingRaceCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {(payload?.activeOffers.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle section className="flex items-center gap-2">
                  <Tag className="size-3.5" />
                  Offers
                </CardTitle>
                <CardDescription compact>
                  {payload!.activeOffers.length} active for {date}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {payload!.activeOffers.map((offer) => (
                  <div key={offer.id} className="rounded-md border px-2.5 py-2 text-xs">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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

        <div className="min-w-0 lg:col-span-9">
          <FlashscoreRacecard
            courses={visibleCourses}
            selected={selected}
            selectedId={selectedId}
            onSelectRace={setSelectedId}
            bookiePlaces={bookiePlaces}
            exchangePlaces={exchangePlaces}
            onTrack={trackRace}
            onBet={openBetForRunner}
            onOddsOverride={saveOddsOverride}
            backColor={summary?.backColor ?? deskExchangeRow?.backColor}
            layColor={summary?.layColor ?? deskExchangeRow?.layColor}
            advancedMode={advancedMode}
            refreshLabel={refreshLabel}
            refreshing={refreshing}
            exchangeStatusLabel={exchangeStatusLabel}
          />
        </div>
      </div>
    </PageShell>
  );
}
