"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIXTURE_SPORTS, type Fixture, type RacingFixture } from "@/components/events/types";
import { DeskFixtureBoard } from "@/components/events/desk-fixture-board";
import { toastAddedToTrackedEvents, toastAlreadyTracked } from "@/components/events/track-toast";
import { useAddBet } from "@/components/add-bet-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";
import { epDeskFixtureHref } from "@/lib/calc/ep/fixture-query";
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
      ? "Could not load racecards from the racing feed. Try refresh in a moment."
      : "Could not load fixtures from the football feed. Try refresh in a moment.";
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
  const [footballError, setFootballError] = useState<string | null>(null);
  const [racingError, setRacingError] = useState<string | null>(null);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [fixtureSport, setFixtureSport] = useState<"football" | "horse_racing">("football");
  const [syncingRacing, setSyncingRacing] = useState(false);

  const goTracked = useCallback(() => router.push("/tracked-events"), [router]);

  const loadFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    const [footballResult, racingResult] = await Promise.allSettled([
      api<{ source: string; fixtures: Fixture[]; warning?: string }>("/api/fixtures"),
      api<{ source: string; racecards: RacingFixture[] }>("/api/racing/racecards"),
    ]);

    if (footballResult.status === "fulfilled") {
      setFixtures(footballResult.value.fixtures);
      setFootballError(null);
      if (footballResult.value.warning) {
        toast.message("Using demo football fixtures", {
          description: footballResult.value.warning,
        });
      }
    } else {
      const message = friendlyFixtureError(footballResult.reason, "football");
      setFootballError(message);
      toast.error("Could not load football fixtures", {
        description: message,
      });
    }

    if (racingResult.status === "fulfilled") {
      setRacingFixtures(racingResult.value.racecards);
      setRacingError(null);
    } else {
      const message = friendlyFixtureError(racingResult.reason, "horse_racing");
      setRacingError(message);
      toast.error("Could not load horse racing fixtures", {
        description: message,
      });
    }

    setLoadingFixtures(false);
  }, []);

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

  // Plain derivations - the React Compiler memoizes these better than manual
  // useMemo wrappers it cannot preserve.
  const myEvents = state?.events ?? [];
  const trackedExternalIds = new Set(
    myEvents.filter((e) => e.externalId).map((e) => e.externalId!)
  );

  const filteredFixtures = useMemo(() => {
    if (fixtureSport !== "football") return [];
    return sortFixturesByKickoff(fixtures.filter((f) => isCurrentOrFutureFixture(f.status)));
  }, [fixtures, fixtureSport]);

  const filteredRaces = useMemo(
    () =>
      fixtureSport === "horse_racing"
        ? sortFixturesByKickoff(racingFixtures.filter((r) => isCurrentOrFutureFixture(r.status)))
        : [],
    [racingFixtures, fixtureSport]
  );

  function openEpDesk(fixture: Fixture) {
    if (variant === "dialog") closeTrackFixture();
    router.push(
      epDeskFixtureHref({
        home: fixture.homeTeam,
        away: fixture.awayTeam,
        startTime: fixture.startTime,
        tab: "dutch",
      })
    );
  }

  const sourceHint =
    fixtureSport === "horse_racing"
      ? "UK & IRE racecards."
      : "Live and upcoming football.";

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {variant === "page" ? (
          <CardTitle section>Fixture browser</CardTitle>
        ) : null}
        <p
          className={cn(
            "text-sm text-muted-foreground",
            variant === "page" ? "" : "mt-0"
          )}
        >
          {sourceHint} Use + to track.{" "}
          {variant === "page" ? (
            <>
              Open{" "}
              <Link
                href="/tracked-events"
                className="text-primary-text underline-offset-2 hover:underline"
              >
                Tracked Events
              </Link>{" "}
              for the ones you have added.
            </>
          ) : (
            <>
              <Link href="/fixtures" className="text-primary-text underline-offset-2 hover:underline">
                Open Fixtures page
              </Link>{" "}
              for the full list.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await loadFixtures();
            if (fixtureSport === "horse_racing") {
              await syncRacingResults();
            }
          }}
          disabled={loadingFixtures || syncingRacing}
          className="gap-1.5"
          aria-label={
            fixtureSport === "horse_racing"
              ? "Refresh racecards and results"
              : "Refresh fixtures"
          }
        >
          <RefreshCw
            className={
              loadingFixtures || syncingRacing
                ? "size-3.5 motion-safe:animate-spin"
                : "size-3.5"
            }
          />
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
        <TabsList
          variant="line"
          className="justify-start"
          fadeClassName={
            tabBleed === "dialog" ? "from-page dark:from-card" : "from-card"
          }
        >
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

  const sportError = fixtureSport === "horse_racing" ? racingError : footballError;
  const emptyTitle = sportError
    ? fixtureSport === "horse_racing"
      ? "Could not load racecards"
      : "Could not load fixtures"
    : fixtureSport === "horse_racing"
      ? "No live or upcoming races"
      : "No live or upcoming fixtures";
  const emptyDescription = sportError
    ? "Use Refresh to try again."
    : fixtureSport === "horse_racing"
      ? "Finished races stay on Tracked Events. Try another filter if you expected a card."
      : "Finished matches stay on Tracked Events. Try another filter if you expected a match.";

  const hasSportData =
    fixtureSport === "horse_racing" ? racingFixtures.length > 0 : fixtures.length > 0;
  const showLoadingEmpty = loadingFixtures && !hasSportData;

  const board = (
    <DeskFixtureBoard
      sport={fixtureSport}
      football={filteredFixtures}
      racing={filteredRaces}
      trackedExternalIds={trackedExternalIds}
      onTrackFixture={trackFixture}
      onTrackAndBetFixture={trackAndBetFixture}
      onEpDesk={openEpDesk}
      onTrackRace={trackRace}
      onTrackAndBetRace={trackAndBetRace}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      loading={showLoadingEmpty}
      loadFailed={Boolean(sportError) && !hasSportData}
      displayTimezone={normalizeDisplayTimezone(state?.settings?.displayTimezone)}
    />
  );

  if (variant === "dialog") {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div className="shrink-0 px-6 pt-4">{header}</div>
        <div className="shrink-0 px-6 pb-2">{tabs}</div>
        <ScrollFadeEdges
          className="min-h-0 flex-1"
          fadeClassName="from-page dark:from-card"
          scrollClassName="app-scroll-nested px-6 pb-6"
        >
          {board}
        </ScrollFadeEdges>
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
