"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FIXTURE_SPORTS, type Fixture, type RacingFixture } from "@/components/events/types";
import { toastAddedToTrackedEvents, toastAlreadyTracked } from "@/components/events/track-toast";
import { useAddBet } from "@/components/add-bet-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";
import { isCurrentOrFutureFixture, sortFixturesByKickoff } from "@/lib/events";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";
import { NotebookPen, Plus, RefreshCw } from "lucide-react";

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
      ? "Standard-tier Racing API endpoint unavailable — free racecards should load after refresh. Check credentials in Settings."
      : "API authentication failed — check your API key in Settings.";
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
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [fixtureSport, setFixtureSport] = useState<"football" | "horse_racing">("football");
  const [syncingRacing, setSyncingRacing] = useState(false);

  const goTracked = useCallback(() => router.push("/tracked-events"), [router]);

  const loadFixtures = useCallback(async () => {
    setLoadingFixtures(true);
    const [footballResult, racingResult] = await Promise.allSettled([
      api<{ source: string; fixtures: Fixture[] }>("/api/fixtures"),
      api<{ source: string; racecards: RacingFixture[] }>("/api/racing/racecards"),
    ]);

    if (footballResult.status === "fulfilled") {
      setFixtures(footballResult.value.fixtures);
      if (fixtureSport === "football") setFixtureSource(footballResult.value.source);
    } else {
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
      const result = await api<{ updated: number; pending: number }>("/api/racing/sync-results", {
        method: "POST",
      });
      await refresh();
      if (result.updated > 0) {
        toast.success(`Settled ${result.updated} race${result.updated === 1 ? "" : "s"} from API`, {
          action: { label: "Tracked Events", onClick: goTracked },
        });
      } else if (result.pending > 0) {
        toast.info("No API results yet", {
          description:
            "Free tier has racecards only — set the winner on Tracked Events, or upgrade for auto results.",
        });
      } else {
        toast.info("Nothing to sync");
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

  const filteredFixtures = useMemo(
    () =>
      fixtureSport === "football"
        ? sortFixturesByKickoff(fixtures.filter((f) => isCurrentOrFutureFixture(f.status)))
        : [],
    [fixtures, fixtureSport]
  );

  const filteredRaces = useMemo(
    () =>
      fixtureSport === "horse_racing"
        ? sortFixturesByKickoff(racingFixtures.filter((r) => isCurrentOrFutureFixture(r.status)))
        : [],
    [racingFixtures, fixtureSport]
  );

  const sourceHint =
    fixtureSport === "horse_racing"
      ? fixtureSource === "racing-api"
        ? "UK & IRE racecards from The Racing API."
        : "Demo racecards — add RACING_API credentials to .env.local."
      : fixtureSource === "api-football"
        ? "Today's live and upcoming fixtures from API-Football."
        : "Demo fixtures — add API_FOOTBALL_KEY to .env.local.";

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
        {fixtureSport === "horse_racing" && (
          <Button
            variant="outline"
            size="sm"
            disabled={syncingRacing}
            onClick={syncRacingResults}
            className="gap-1.5"
          >
            <RefreshCw className={syncingRacing ? "size-3.5 animate-spin" : "size-3.5"} />
            Sync
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={loadFixtures} disabled={loadingFixtures}>
          Refresh
        </Button>
      </div>
    </div>
  );

  const tabs = (
    <Tabs
      value={fixtureSport}
      onValueChange={(v) => setFixtureSport(v as "football" | "horse_racing")}
      className={variant === "page" ? "mt-3" : "mt-4"}
    >
      <TabsList variant="segmented">
            {FIXTURE_SPORTS.map((sport) => (
              <TabsTrigger key={sport.id} value={sport.id} className="gap-1.5">
                <SportIcon sport={sport.id} size={14} />
                {sport.label}
              </TabsTrigger>
            ))}
      </TabsList>
    </Tabs>
  );

  const table = (
    <TooltipProvider delayDuration={200}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{fixtureSport === "horse_racing" ? "Course" : "Competition"}</TableHead>
            <TableHead>{fixtureSport === "horse_racing" ? "Race" : "Match"}</TableHead>
            <TableHead>{fixtureSport === "horse_racing" ? "Off time" : "Kick-off"}</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-16 text-right">Track</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fixtureSport === "football" && filteredFixtures.length === 0 && (
            <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No live or upcoming fixtures — finished matches are hidden. Try Refresh.
                  </TableCell>
            </TableRow>
          )}
          {fixtureSport === "horse_racing" && filteredRaces.length === 0 && (
            <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No live or upcoming races — finished races are hidden. Try Refresh.
                  </TableCell>
            </TableRow>
          )}
          {filteredFixtures.map((fixture) => {
            const isTracked = trackedExternalIds.has(fixture.externalId);
            return (
                  <TableRow key={fixture.externalId}>
                    <TableCell className="text-sm text-muted-foreground">{fixture.competition}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <SportIcon sport="football" size={14} className="text-muted-foreground/70" />
                        {fixture.homeTeam} v {fixture.awayTeam}
                      </span>
                  {fixture.status === "live" && (
                    <Badge variant="secondary" className="ml-2 tabular-nums">
                      {fixture.homeScore}–{fixture.awayScore}
                      {fixture.minute > 0 ? ` · ${fixture.minute}'` : ""}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {new Date(fixture.startTime).toLocaleString("en-GB", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  {fixture.status === "live" ? (
                    <Badge className="bg-emerald-600 text-[10px]">live</Badge>
                  ) : (
                    <Badge
                      variant={fixture.status === "finished" ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {fixture.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    {isTracked ? (
                      <>
                        <Link
                          href="/tracked-events"
                          className="mr-1 text-xs font-medium text-muted-foreground hover:text-primary"
                        >
                          Tracked
                        </Link>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Add bet on this event"
                              onClick={() => trackAndBetFixture(fixture)}
                            >
                              <NotebookPen className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Add bet</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Track and add bet"
                              onClick={() => trackAndBetFixture(fixture)}
                            >
                              <NotebookPen className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Track &amp; add bet</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Add to Tracked Events"
                              onClick={() => trackFixture(fixture)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Track only</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {filteredRaces.map((race) => {
            const isTracked = trackedExternalIds.has(race.externalId);
            return (
                  <TableRow key={race.externalId}>
                    <TableCell className="text-sm text-muted-foreground">{race.course}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <SportIcon sport="horse_racing" size={14} className="text-muted-foreground/70" />
                        {race.raceName}
                      </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({race.fieldSize} runners)
                  </span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {race.offTime ||
                    new Date(race.startTime).toLocaleString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </TableCell>
                <TableCell>
                  {race.status === "finished" ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {race.winner ? `Won by ${race.winner.split(" ")[0]}` : "Finished"}
                    </Badge>
                  ) : race.status === "live" ? (
                    <Badge className="bg-emerald-600 text-[10px]">Off</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Upcoming
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    {isTracked ? (
                      <>
                        <Link
                          href="/tracked-events"
                          className="mr-1 text-xs font-medium text-muted-foreground hover:text-primary"
                        >
                          Tracked
                        </Link>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Add bet on this race"
                              onClick={() => trackAndBetRace(race)}
                            >
                              <NotebookPen className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Add bet</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Track and add bet"
                              onClick={() => trackAndBetRace(race)}
                            >
                              <NotebookPen className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Track &amp; add bet</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Add to Tracked Events"
                              onClick={() => trackRace(race)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Track only</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );

  if (variant === "dialog") {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div className="shrink-0 border-b px-6 py-4">{header}</div>
        <div className="shrink-0 px-6 pb-2">{tabs}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{table}</div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        {header}
        {tabs}
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}

/** Full-width fixture browser for the Fixtures page. */
export function FixtureBrowser() {
  return <FixtureBrowserContent variant="page" />;
}
