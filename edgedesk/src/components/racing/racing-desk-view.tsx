"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  formatOfferScopeLabel,
} from "@/lib/offers/racing-offer-rules";
import type { RacingDeskPayload, RacingDeskRace } from "@/lib/racing-desk/types";
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
import { cn } from "@/lib/utils";
import { listRowSelected } from "@/lib/ui/surface-styles";
import {
  deskRaceToPendingSettle,
  isDeskRacePendingSettle,
} from "@/lib/racing/pending-settle";

export function RacingDeskView() {
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { defaultExchange } = useExchanges();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payload, setPayload] = useState<RacingDeskPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookiePlaces, setBookiePlaces] = useState(4);
  const [exchangePlaces, setExchangePlaces] = useState(3);
  const [epStake, setEpStake] = useState(10);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [qualifyingOnly, setQualifyingOnly] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<RacingDeskPayload>(`/api/racing/desk?date=${date}`);
      setPayload(res);
      setSelectedId((prev) => prev ?? res.races[0]?.externalId ?? null);
    } catch (e) {
      toast.error("Could not load racing desk", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    queueMicrotask(load);
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

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
    mode: "win" | "extra_place" | "place_refund" | "lay"
  ) {
    const runner = race.runners.find((r) => r.name === runnerName);
    const winOdds = runner?.bookieDecimal ?? runner?.spDecimal ?? 8;
    const layOdds = runner?.exchangeDecimal ?? winOdds * 1.03;

    if (mode === "lay") {
      const offerTag = race.offerTags
        .filter((t) => t.qualifies)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      openMatchedCalculator({
        mode: "qualifying",
        bookmaker: offerTag?.bookmaker ?? undefined,
        backStake: offerTag?.betStake ?? epStake,
        backOdds: winOdds,
        layOdds,
        exchangeId: defaultExchange?.id,
        commission: defaultExchange?.commissionPct,
      });
      return;
    }

    let eventId = race.trackedEventId;
    if (!eventId) {
      eventId = (await trackRace(race)) ?? undefined;
    }

    if (mode === "place_refund") {
      const offerTag = race.offerTags
        .filter((t) => t.qualifies)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
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
        backStake: offerTag.betStake ?? epStake,
        bookmaker: offerTag.bookmaker ?? undefined,
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

  const pendingSettleRaces = useMemo(
    () => (payload?.races ?? []).filter(isDeskRacePendingSettle).map(deskRaceToPendingSettle),
    [payload?.races]
  );

  return (
    <PageShell>
      <PageHeader
        helpId="racing"
        title="Racing Desk"
        description="Racecards, live lay odds, and offer-aware targeting for UK & IRE."
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
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-36"
            />
            <Button variant="outline" size="icon-lg" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </>
        }
      />

      <RacingIntelligenceDialog
        open={intelligenceOpen}
        onOpenChange={setIntelligenceOpen}
        suggestions={suggestions}
        onSelectRace={setSelectedId}
        onBackRunner={(raceId, runnerName) => {
          const race = payload?.races.find((r) => r.externalId === raceId);
          if (race) void openBetForRunner(race, runnerName, "place_refund");
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
          racingApiConfigured={summary?.premiumOddsApi}
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

      {(summary?.oddsNote ||
        (summary?.exchangeNote && summary.exchangeStatus !== "connected") ||
        summary?.exchangeStatus === "connected") && (
        <div className="flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs">
          {summary?.oddsNote && (
            <p className="text-amber-800 dark:text-amber-200">{summary.oddsNote}</p>
          )}
          {summary?.exchangeNote && summary.exchangeStatus !== "connected" && (
            <p className="text-muted-foreground">
              Connect {summary.exchangeName ?? "your exchange"} in{" "}
              <Link href="/settings" className="font-medium underline underline-offset-2">
                Settings → Data &amp; API
              </Link>{" "}
              for live lay odds. {summary.exchangeNote}
            </p>
          )}
          {summary?.exchangeStatus === "connected" && summary.exchangeFeedType && (
            <p className="text-emerald-700 dark:text-emerald-300">
              Live {summary.exchangeName} lay odds ({summary.exchangeFeedType} feed)
            </p>
          )}
        </div>
      )}

      {payload?.error && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          API note: {payload.error} — showing fallback data.
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
          action={{ label: "Add racing offer", href: "/offers" }}
          secondaryAction={{ label: "Racing Desk guide", href: "/help?guide=racing-desk" }}
        />
      )}

      {payload && payload.activeOffers.length === 0 && !loading && (payload.races.length ?? 0) > 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">No active racing offers for {date}</p>
              <p className="text-xs text-muted-foreground">
                Add a place-refund offer to unlock Intelligence suggestions.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/offers">
                <Plus className="size-3.5" />
                Add offer
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <DeskFilterPills
        qualifyingOnly={qualifyingOnly}
        onQualifyingOnlyChange={setQualifyingOnly}
        advancedMode={advancedMode}
        onAdvancedModeChange={setAdvancedMode}
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
                const offerCount = races.filter((r) => r.offerTags.some((t) => t.qualifies)).length;
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
                    <span className="font-medium">{course}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {races.length}
                      {offerCount > 0 && (
                        <span className="size-1.5 rounded-full bg-emerald-500" title="Qualifying races" />
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
                    <p className="mt-0.5 text-muted-foreground">
                      {offer.bookmaker ?? "Any bookie"} · {formatOfferScopeLabel(offer.scopeCourse)}
                    </p>
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
            advancedMode={advancedMode}
          />
        </div>
      </div>
    </PageShell>
  );
}
