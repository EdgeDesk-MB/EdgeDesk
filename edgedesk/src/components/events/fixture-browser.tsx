"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIXTURE_SPORTS, type Fixture, type RacingFixture } from "@/components/events/types";
import { FlashscoreFixtureBoard } from "@/components/events/flashscore-fixture-board";
import { toastAddedToTrackedEvents, toastAlreadyTracked } from "@/components/events/track-toast";
import { useAddBet } from "@/components/add-bet-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";
import { isWorldCupCompetition } from "@/lib/accounts/access";
import { isCurrentOrFutureFixture, sortFixturesByKickoff } from "@/lib/events";
import { normalizeDisplayTimezone } from "@/lib/display-timezone";
import { racingSyncToast } from "@/lib/racing/sync-toast";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

function friendlyFixtureError(error: unknown, sport: "football" | "horse_racing"): string {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonBody = raw.match(/^\d+:\s*(\{[\s\S]*\})/)?.[1];
  if (jsonBody) {
    try {
      const parsed = JSON.parse(jsonBody) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      /* ignore malformed JSON */
    }
  }

  const lower = raw.toLowerCase();
  if (lower.includes("plan tier") || lower.includes("auth failed")) {
    return sport === "horse_racing"
      ? "Standard-tier Racing API endpoint unavailable - free racecards should load after refresh. Check credentials in Settings."
      : "API authentication failed - check your API key in Settings.";
  }

  return raw.replace(/^\d+:\s*/, "").slice(0, 200);
}

export function FixtureBrowserContent({
  variant = "page",
  className,
}: {
  variant?: "page" | "dialog";
  className?: string;
}) {
  const router = useRouter();
  const { openAddBet } = useAddBet();
  const { closeTrackFixture } = useTrackFixture();
  const { state, refresh } = useAppState(5000);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [racingFixtures, setRacingFixtures] = useState<RacingFixture[]>([]);
  const [fixtureSource, setFixtureSource] = useState<string>("");
  const [fixtureWarning, setFixtureWarning] = useState<string>("");
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [fixtureSport, setFixtureSport] = useState<"football" | "horse_racing">("football");
  const [syncingRacing, setSyncingRacing] = useState(false);
  const [competitionFilter, setCompetitionFilter] = useState<"all" | "world_cup">("all");

  const goTracked = useCallback(() => router.push("/tracked-events"), [router]);

  const loadFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    const [footballResult, racingResult] = await Promise.allSettled([
      api<{ source: string; fixtures: Fixture[]; warning?: string }>("/api/fixtures"),
      api<{ source: string; racecards: RacingFixture[] }>("/api/racing/racecards"),
    ]);

    if (footballResult.status === "fulfilled") {
      setFixtures(footballResult.value.fixtures);
      setFixtureWarning(footballResult.value.warning ?? "");
      if (fixtureSport === "football") setFixtureSource(footballResult.value.source);
      if (footballResult.value.warning) {
        toast.message("Using demo football fixtures", {
          description: footballResult.value.warning,
        });
      }
    } else {
      setFixtureWarning("");
      toast.error("Could not load football fixtures", {
        description: friendlyFixtureError(footballResult.reason, "football"),
      });
    }

    if (racingResult.status === "fulfilled") {
      setRacingFixtures(racingResult.value.racecards);
      if (fixtureSport === "horse_racing") setFixtureSource(racingResult.value.source);
    } else {
      toast.error("Could not load horse racing fixtures", {
        description: friendlyFixtureError(racingResult.reason, "horse_racing"),
      });
    }

    setLoadingFixtures(false);
  }, [fixtureSport]);

  useEffect(() => {
    queueMicrotask(loadFixtures);
  }, [loadFixtures]);

  const syncRacingResults = useCallback(async () => {
    setSyncingRacing(true);
    try {
      const result = await api<{
        updated: number;
        pending: number;
        tierBlocked?: boolean;
        tier?: "basic" | "free" | "none";
      }>("/api/racing/sync-results", {
        method: "POST",
      });
      await refresh();
      const msg = racingSyncToast(result);
      if (msg.kind === "success") {
        toast.success(msg.title, {
          action: { label: "Tracked Events", onClick: goTracked },
        });
      } else {
        toast.info(msg.title, msg.description ? { description: msg.description } : undefined);
      }
    } catch (e) {
      toast.error("Racing sync failed", { description: String(e) });
    } finally {
      setSyncingRacing(false);
    }
  }, [refresh, goTracked]);

  async function trackFixture(fixture: Fixture): Promise<EventRow | null> {
    const label = `${fixture.homeTeam} v ${fixture.awayTeam}`;
    if (trackedExternalIds.has(fixture.externalId)) {
      toastAlreadyTracked(goTracked);
      return myEvents.find((e) => e.externalId === fixture.externalId) ?? null;
    }
    try {
      const res = await api<{ event: EventRow; existing?: boolean }>("/api/events", {
        method: "POST",
        json: {
          sport: "football",
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          competition: fixture.competition,
          startTime: fixture.startTime,
          source: "api",
          externalId: fixture.externalId,
          status: fixture.status,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          minute: fixture.minute,
        },
      });
      if (res.existing) toastAlreadyTracked(goTracked);
      else toastAddedToTrackedEvents(label, goTracked);
      refresh();
      return res.event;
    } catch (e) {
      toast.error("Could not track fixture", { description: String(e) });
      return null;
    }
  }

  async function trackAndBetFixture(fixture: Fixture) {
    const event =
      myEvents.find((e) => e.externalId === fixture.externalId) ??
      (await trackFixture(fixture));
    if (!event) return;
    if (variant === "dialog") closeTrackFixture();
    openAddBet({
      eventId: event.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      sport: "football",
      labelSuggestion: `${fixture.homeTeam} v ${fixture.awayTeam}`,
    });
  }

  async function trackRace(race: RacingFixture): Promise<EventRow | null> {
    const label = `${race.course} · ${race.offTime || race.raceName}`;
    if (trackedExternalIds.has(race.externalId)) {
      toastAlreadyTracked(goTracked);
      return myEvents.find((e) => e.externalId === race.externalId) ?? null;
    }
    try {
      const res = await api<{ event: EventRow; existing?: boolean }>("/api/events", {
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
          runners: race.runners,
        },
      });
      await api("/api/racing/sync-results?eventId=" + res.event.id, { method: "POST" });
      if (res.existing) toastAlreadyTracked(goTracked);
      else toastAddedToTrackedEvents(label, goTracked);
      refresh();
      return res.event;
    } catch (e) {
      toast.error("Could not track race", { description: String(e) });
      return null;
    }
  }

  async function trackAndBetRace(race: RacingFixture) {
    const event =
      myEvents.find((e) => e.externalId === race.externalId) ?? (await trackRace(race));
    if (!event) return;
    if (variant === "dialog") closeTrackFixture();
    openAddBet({
      eventId: event.id,
      homeTeam: race.raceName,
      awayTeam: race.offTime,
      sport: "horse_racing",
      market: "win",
      labelSuggestion: `${race.course} · ${race.offTime || race.raceName}`,
    });
  }

  const myEvents = state?.events ?? [];
  const trackedExternalIds = useMemo(
    () => new Set(myEvents.filter((e) => e.externalId).map((e) => e.externalId!)),
    [myEvents]
  );

  const worldCupCount = useMemo(
    () => fixtures.filter((f) => isCurrentOrFutureFixture(f.status) && isWorldCupCompetition(f.competition)).length,
    [fixtures]
  );

  const filteredFixtures = useMemo(() => {
    if (fixtureSport !== "football") return [];
    let list = fixtures.filter((f) => isCurrentOrFutureFixture(f.status));
    if (competitionFilter === "world_cup") {
      list = list.filter((f) => isWorldCupCompetition(f.competition));
    }
    return sortFixturesByKickoff(list);
  }, [fixtures, fixtureSport, competitionFilter]);

  const filteredRaces = useMemo(
    () =>
      fixtureSport === "horse_racing"
        ? sortFixturesByKickoff(racingFixtures.filter((r) => isCurrentOrFutureFixture(r.status)))
        : [],
    [racingFixtures, fixtureSport]
  );

  function openEpDesk(fixture: Fixture) {
    if (variant === "dialog") closeTrackFixture();
    const q = new URLSearchParams({
      home: fixture.homeTeam,
      away: fixture.awayTeam,
      tab: "dutch",
    });
    router.push(`/calculators/ep-desk?${q.toString()}`);
  }

  const sourceHint =
    fixtureSport === "horse_racing"
      ? fixtureSource === "racing-api"
        ? "UK & IRE racecards."
        : "Demo racecards."
      : fixtureSource === "api-football"
        ? "Live and upcoming fixtures."
        : fixtureWarning
          ? "Demo fixtures (API limit or missing key)."
          : "Demo fixtures.";

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {variant === "page" ? (
          <CardTitle section>Fixture browser</CardTitle>
        ) : (
          <h2 className="text-base font-semibold">Browse fixtures</h2>
        )}
        <p
          className={cn(
            "text-sm text-muted-foreground",
            variant === "page" ? "" : "mt-0.5"
          )}
        >
          {sourceHint} Use + to add to Tracked Events.
          {variant === "page" ? (
            <>
              {" "}
              Already tracking?{" "}
              <Link
                href="/tracked-events"
                className="text-primary underline-offset-2 hover:underline"
              >
                Tracked Events
              </Link>
            </>
          ) : (
            <>
              {" "}
              <Link href="/fixtures" className="text-primary underline-offset-2 hover:underline">
                Open Fixtures page
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={fixtureSport !== "horse_racing" || syncingRacing}
          onClick={syncRacingResults}
          className={cn(
            "gap-1.5",
            fixtureSport !== "horse_racing" && "pointer-events-none invisible"
          )}
          aria-hidden={fixtureSport !== "horse_racing"}
          tabIndex={fixtureSport !== "horse_racing" ? -1 : undefined}
        >
          <RefreshCw className={syncingRacing ? "size-3.5 animate-spin" : "size-3.5"} />
          Sync
        </Button>
        <Button variant="outline" size="sm" onClick={loadFixtures} disabled={loadingFixtures}>
          Refresh
        </Button>
      </div>
    </div>
  );

  const tabBleed = variant === "dialog" ? "dialog" : "card";

  const tabs = (
    <TabsLineBar bleed={tabBleed} className={variant === "page" ? "mt-3" : "mt-4"}>
      <Tabs
        value={fixtureSport}
        onValueChange={(v) => setFixtureSport(v as "football" | "horse_racing")}
        className="gap-0"
      >
        <TabsList variant="line">
          {FIXTURE_SPORTS.map((sport) => (
            <TabsTrigger key={sport.id} value={sport.id} className="gap-1.5">
              <SportIcon sport={sport.id} size={14} />
              {sport.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </TabsLineBar>
  );

  const emptyMessage =
    fixtureSport === "horse_racing"
      ? "No live or upcoming races - finished races are hidden. Try Refresh or another filter."
      : competitionFilter === "world_cup"
        ? "No World Cup fixtures in today's feed - try All comps or Refresh."
        : "No live or upcoming fixtures - finished matches are hidden. Try Refresh or another filter.";

  const board = (
    <FlashscoreFixtureBoard
      sport={fixtureSport}
      football={filteredFixtures}
      racing={filteredRaces}
      trackedExternalIds={trackedExternalIds}
      onTrackFixture={trackFixture}
      onTrackAndBetFixture={trackAndBetFixture}
      onEpDesk={openEpDesk}
      onTrackRace={trackRace}
      onTrackAndBetRace={trackAndBetRace}
      emptyMessage={emptyMessage}
      competitionFilter={competitionFilter}
      onCompetitionFilterChange={setCompetitionFilter}
      worldCupCount={worldCupCount}
      displayTimezone={normalizeDisplayTimezone(state?.settings?.displayTimezone)}
    />
  );

  if (variant === "dialog") {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div className="shrink-0 border-b px-6 py-4">{header}</div>
        <div className="shrink-0 px-6 pb-2">{tabs}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{board}</div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        {header}
        {tabs}
      </CardHeader>
      <CardContent className="pt-0">{board}</CardContent>
    </Card>
  );
}

/** Full-width fixture browser for the Fixtures page. */
export function FixtureBrowser() {
  return <FixtureBrowserContent variant="page" />;
}
