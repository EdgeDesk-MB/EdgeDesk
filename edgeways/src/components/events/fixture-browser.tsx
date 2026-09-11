"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FIXTURE_SPORTS,
  type Fixture,
  type FootballCompetition,
  type RacingFixture,
} from "@/components/events/types";
import { CalendarDayStepper } from "@/components/calendar-day-stepper";
import { DeskFixtureBoard } from "@/components/events/desk-fixture-board";
import {
  toastAddedToTrackedEvents,
  toastAlreadyTracked,
  toastRemovedFromTrackedEvents,
} from "@/components/events/track-toast";
import { useAddBet } from "@/components/add-bet-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { api, apiGet, useAppState } from "@/hooks/use-app-state";
import type { EventRow } from "@/lib/db/schema";
import { epDeskFixtureHref } from "@/lib/calc/ep/fixture-query";
import {
  clampCalendarYmd,
  fixtureListDayBounds,
  formatRacingEventTitle,
  sortFixturesByKickoff,
} from "@/lib/events";
import {
  liveViewFootballAddBetPrefill,
  liveViewRacingAddBetPrefill,
} from "@/lib/events/live-view-add-bet";
import {
  adjacentFixtureDays,
  formatFixtureStepperLabel,
} from "@/lib/events/fixture-day-groups";
import { normalizeDisplayTimezone } from "@/lib/display-timezone";
import { LIVE_TTL_MS } from "@/lib/live-poll-rules";
import { canDesk } from "@/lib/entitlements/effective-plan";
import {
  mergeFixtureBoardView,
  normalizeFixtureBoardView,
} from "@/lib/events/fixture-board-view";
import { SportIcon } from "@/components/sport-icon";
import { PlanLockEmpty } from "@/components/plan-lock-empty";
import { cn } from "@/lib/utils";

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
      ? "Could not load racecards from the racing feed. Try again in a moment."
      : "Could not load fixtures from the football feed. Try again in a moment.";
  }

  return raw.replace(/^\d+:\s*/, "").slice(0, 200);
}

/** Client TTL for a fixture day. The server store is 10 minutes. */
const FIXTURE_DAY_TTL_MS = 2 * 60_000;
/** Today’s football list follows the live-score cache. */
const LIVE_FIXTURE_POLL_MS = LIVE_TTL_MS;

type CachedFixtureDay = {
  at: number;
  footballReady: boolean;
  racingReady: boolean;
  fixtures: Fixture[];
  competitions: FootballCompetition[];
  racecards: RacingFixture[];
  footballError: string | null;
  racingError: string | null;
  warning?: string;
};

const fixtureDayCache = new Map<string, CachedFixtureDay>();

function peekFixtureDay(day: string): CachedFixtureDay | null {
  const hit = fixtureDayCache.get(day);
  if (!hit || Date.now() - hit.at >= FIXTURE_DAY_TTL_MS) return null;
  return hit;
}

function storeFixtureDay(day: string, value: Omit<CachedFixtureDay, "at">) {
  fixtureDayCache.set(day, { ...value, at: Date.now() });
}

function mergeStoredDay(
  day: string,
  patch: Partial<Omit<CachedFixtureDay, "at">>
): CachedFixtureDay {
  const previous = peekFixtureDay(day);
  const next: Omit<CachedFixtureDay, "at"> = {
    footballReady: patch.footballReady ?? previous?.footballReady ?? false,
    racingReady: patch.racingReady ?? previous?.racingReady ?? false,
    fixtures: patch.fixtures ?? previous?.fixtures ?? [],
    competitions: patch.competitions ?? previous?.competitions ?? [],
    racecards: patch.racecards ?? previous?.racecards ?? [],
    footballError:
      patch.footballError !== undefined
        ? patch.footballError
        : (previous?.footballError ?? null),
    racingError:
      patch.racingError !== undefined ? patch.racingError : (previous?.racingError ?? null),
    warning: patch.warning ?? previous?.warning,
  };
  storeFixtureDay(day, next);
  return { ...next, at: Date.now() };
}

function footballDayPath(day: string) {
  return `/api/fixtures?date=${encodeURIComponent(day)}`;
}

function racingDayPath(day: string) {
  return `/api/racing/racecards?date=${encodeURIComponent(day)}`;
}

function requestFootballDay(day: string) {
  return apiGet<{
    source: string;
    fixtures: Fixture[];
    competitions?: FootballCompetition[];
    warning?: string;
  }>(footballDayPath(day), FIXTURE_DAY_TTL_MS);
}

function requestRacingDay(day: string) {
  return apiGet<{ source: string; racecards: RacingFixture[] }>(
    racingDayPath(day),
    FIXTURE_DAY_TTL_MS
  );
}

export function FixtureBrowserContent({
  variant = "page",
  header = null,
  className,
}: {
  variant?: "page" | "dialog";
  header?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const { openAddBet } = useAddBet();
  const { closeTrackFixture } = useTrackFixture();
  const { state, refresh, applyLocalSettingsPatch } = useAppState(5000);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [competitions, setCompetitions] = useState<FootballCompetition[]>([]);
  const [racingFixtures, setRacingFixtures] = useState<RacingFixture[]>([]);
  const [footballError, setFootballError] = useState<string | null>(null);
  const [racingError, setRacingError] = useState<string | null>(null);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const savedSport = normalizeFixtureBoardView(state?.settings.fixtureBoardView).sport;
  const [fixtureSport, setFixtureSport] = useState<"football" | "horse_racing">(savedSport);
  const [appliedSport, setAppliedSport] = useState(savedSport);
  if (state != null && appliedSport !== savedSport) {
    setAppliedSport(savedSport);
    setFixtureSport(savedSport);
  }
  const dayBounds = useMemo(() => fixtureListDayBounds(), []);
  const [listDay, setListDay] = useState(dayBounds.today);
  const [dayReady, setDayReady] = useState({
    day: dayBounds.today,
    football: false,
    racing: false,
  });
  const listDayRef = useRef(listDay);
  listDayRef.current = listDay;
  const fixtureSportRef = useRef(fixtureSport);
  fixtureSportRef.current = fixtureSport;
  const loadGenRef = useRef(0);
  const [trackOverride, setTrackOverride] = useState<Record<string, boolean>>({});
  const trackInflight = useRef(new Map<string, Promise<EventRow | null>>());

  function overrideTrack(externalId: string, on: boolean) {
    setTrackOverride((prev) => (prev[externalId] === on ? prev : { ...prev, [externalId]: on }));
  }
  const warnedDaysRef = useRef(new Set<string>());

  const goTracked = useCallback(() => router.push("/tracked-events"), [router]);

  function persistFixtureSport(next: "football" | "horse_racing") {
    setFixtureSport(next);
    const current = normalizeFixtureBoardView(state?.settings.fixtureBoardView);
    const fixtureBoardView = mergeFixtureBoardView(current, { sport: next });
    applyLocalSettingsPatch({ fixtureBoardView });
    void api("/api/settings", { method: "PATCH", json: { fixtureBoardView } }).catch(() => {
      applyLocalSettingsPatch({ fixtureBoardView: current });
    });
  }

  const loadCompetitionCatalog = useCallback(async (alreadyHave: boolean) => {
    if (alreadyHave) {
      setLoadingCompetitions(false);
      return;
    }
    setLoadingCompetitions(true);
    try {
      const payload = await api<{ competitions?: FootballCompetition[] }>(
        "/api/fixtures/competitions"
      );
      if (payload.competitions?.length) setCompetitions(payload.competitions);
    } catch {
      // The day list already painted. Search can retry on the next refresh.
    } finally {
      setLoadingCompetitions(false);
    }
  }, []);

  const applyDay = useCallback((day: string, cached: CachedFixtureDay) => {
    setFixtures(cached.fixtures);
    setRacingFixtures(cached.racecards);
    if (cached.competitions.length > 0) setCompetitions(cached.competitions);
    setFootballError(cached.footballError);
    setRacingError(cached.racingError);
    setDayReady({
      day,
      football: cached.footballReady,
      racing: cached.racingReady,
    });
  }, []);

  const prefetchNeighbourDays = useCallback(
    (day: string) => {
      for (const neighbour of adjacentFixtureDays(day, dayBounds.min, dayBounds.max)) {
        if (peekFixtureDay(neighbour)) continue;
        void (async () => {
          const [footballResult, racingResult] = await Promise.allSettled([
            requestFootballDay(neighbour).then((payload) => {
              mergeStoredDay(neighbour, {
                footballReady: true,
                fixtures: payload.fixtures,
                competitions: payload.competitions ?? [],
                footballError: null,
                warning: payload.warning,
              });
              return payload;
            }),
            requestRacingDay(neighbour).then((payload) => {
              mergeStoredDay(neighbour, {
                racingReady: true,
                racecards: payload.racecards,
                racingError: null,
              });
              return payload;
            }),
          ]);
          if (footballResult.status === "rejected") {
            mergeStoredDay(neighbour, {
              footballReady: true,
              fixtures: [],
              footballError: friendlyFixtureError(footballResult.reason, "football"),
            });
          }
          if (racingResult.status === "rejected") {
            mergeStoredDay(neighbour, {
              racingReady: true,
              racecards: [],
              racingError: friendlyFixtureError(racingResult.reason, "horse_racing"),
            });
          }
        })();
      }
    },
    [dayBounds.max, dayBounds.min]
  );

  const loadFixtures = useCallback(
    async (day: string) => {
      const gen = ++loadGenRef.current;
      const cached = peekFixtureDay(day);
      if (cached) {
        applyDay(day, cached);
      } else {
        setFixtures([]);
        setRacingFixtures([]);
        setFootballError(null);
        setRacingError(null);
        setDayReady({ day, football: false, racing: false });
      }

      prefetchNeighbourDays(day);

      const preferFootball = fixtureSportRef.current === "football";
      const applyIfCurrent = (patch: Partial<CachedFixtureDay> & { day: string }) => {
        if (gen !== loadGenRef.current || listDayRef.current !== patch.day) return false;
        const merged = mergeStoredDay(patch.day, {
          fixtures: patch.fixtures,
          competitions: patch.competitions,
          racecards: patch.racecards,
          footballError: patch.footballError,
          racingError: patch.racingError,
          warning: patch.warning,
          footballReady:
            patch.fixtures != null || patch.footballError != null ? true : undefined,
          racingReady:
            patch.racecards != null || patch.racingError != null ? true : undefined,
        });
        setFixtures(merged.fixtures);
        setRacingFixtures(merged.racecards);
        if (merged.competitions.length > 0) setCompetitions(merged.competitions);
        setFootballError(merged.footballError);
        setRacingError(merged.racingError);
        setDayReady({
          day: patch.day,
          football: merged.footballReady,
          racing: merged.racingReady,
        });
        return true;
      };

      const loadFootball = async () => {
        try {
          const payload = await requestFootballDay(day);
          if (!applyIfCurrent({
            day,
            fixtures: payload.fixtures,
            competitions: payload.competitions ?? [],
            footballError: null,
            warning: payload.warning,
          })) {
            return;
          }
          if (payload.warning && !warnedDaysRef.current.has(day)) {
            warnedDaysRef.current.add(day);
            toast.message("Using demo football fixtures", {
              description: payload.warning,
            });
          }
          void loadCompetitionCatalog((payload.competitions?.length ?? 0) > 0);
        } catch (error) {
          const message = friendlyFixtureError(error, "football");
          if (!applyIfCurrent({ day, fixtures: [], footballError: message })) return;
          toast.error("Could not load football fixtures", { description: message });
          setLoadingCompetitions(false);
        }
      };

      const loadRacing = async () => {
        try {
          const payload = await requestRacingDay(day);
          applyIfCurrent({ day, racecards: payload.racecards, racingError: null });
        } catch (error) {
          const message = friendlyFixtureError(error, "horse_racing");
          if (!applyIfCurrent({ day, racecards: [], racingError: message })) return;
          toast.error("Could not load horse racing fixtures", { description: message });
        }
      };

      if (preferFootball) {
        await loadFootball();
        await loadRacing();
      } else {
        await loadRacing();
        await loadFootball();
      }
    },
    [applyDay, loadCompetitionCatalog, prefetchNeighbourDays]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadFixtures(listDay);
    });
  }, [listDay, loadFixtures]);

  useEffect(() => {
    if (listDay !== dayBounds.today || fixtureSport !== "football") return;
    let cancelled = false;
    const refreshLive = () =>
      api<{
        fixtures: Fixture[];
        competitions?: FootballCompetition[];
        warning?: string;
      }>(footballDayPath(listDay))
        .then((payload) => {
          if (cancelled || listDayRef.current !== listDay) return;
          mergeStoredDay(listDay, {
            footballReady: true,
            fixtures: payload.fixtures,
            competitions: payload.competitions ?? [],
            footballError: null,
            warning: payload.warning,
          });
          setFixtures(payload.fixtures);
          if (payload.competitions?.length) setCompetitions(payload.competitions);
          setFootballError(null);
        })
        .catch(() => {
          /* keep the last card; the next tick retries */
        });
    const kick = window.setTimeout(() => {
      void refreshLive();
    }, 1_000);
    const id = window.setInterval(() => {
      void refreshLive();
    }, LIVE_FIXTURE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [dayBounds.today, fixtureSport, listDay]);

  async function trackFixture(fixture: Fixture): Promise<EventRow | null> {
    const label = `${fixture.homeTeam} v ${fixture.awayTeam}`;
    const existing = myEvents.find((e) => e.externalId === fixture.externalId);
    if (existing) {
      overrideTrack(fixture.externalId, true);
      toastAlreadyTracked(goTracked);
      return existing;
    }
    overrideTrack(fixture.externalId, true);
    const run = (async () => {
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
        overrideTrack(fixture.externalId, false);
        toast.error("Could not track fixture", { description: String(e) });
        return null;
      }
    })();
    trackInflight.current.set(fixture.externalId, run);
    const event = await run;
    trackInflight.current.delete(fixture.externalId);
    return event;
  }

  async function untrackFixture(fixture: Fixture) {
    const label = `${fixture.homeTeam} v ${fixture.awayTeam}`;
    overrideTrack(fixture.externalId, false);
    try {
      let event = myEvents.find((row) => row.externalId === fixture.externalId) ?? null;
      if (!event) {
        const pending = trackInflight.current.get(fixture.externalId);
        event = pending ? await pending : null;
      }
      if (!event) return;
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      toastRemovedFromTrackedEvents(label);
      refresh();
    } catch (e) {
      overrideTrack(fixture.externalId, true);
      toast.error("Could not remove this fixture from Tracked Events", {
        description: String(e),
      });
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
      market: "match_odds",
      labelSuggestion: `${fixture.homeTeam} v ${fixture.awayTeam}`,
    });
  }

  function addBetFromLiveFixture(fixture: Fixture) {
    const tracked = myEvents.find((e) => e.externalId === fixture.externalId);
    if (variant === "dialog") closeTrackFixture();
    openAddBet(liveViewFootballAddBetPrefill(fixture, tracked?.id));
  }

  async function trackRace(race: RacingFixture): Promise<EventRow | null> {
    const label = formatRacingEventTitle({
      competition: race.course,
      startTime: race.startTime,
      awayTeam: race.offTime,
    });
    const existing = myEvents.find((e) => e.externalId === race.externalId);
    if (existing) {
      overrideTrack(race.externalId, true);
      toastAlreadyTracked(goTracked);
      return existing;
    }
    overrideTrack(race.externalId, true);
    const run = (async () => {
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
        overrideTrack(race.externalId, false);
        toast.error("Could not track race", { description: String(e) });
        return null;
      }
    })();
    trackInflight.current.set(race.externalId, run);
    const event = await run;
    trackInflight.current.delete(race.externalId);
    return event;
  }

  async function untrackRace(race: RacingFixture) {
    const label = formatRacingEventTitle({
      competition: race.course,
      startTime: race.startTime,
      awayTeam: race.offTime,
    });
    overrideTrack(race.externalId, false);
    try {
      let event = myEvents.find((row) => row.externalId === race.externalId) ?? null;
      if (!event) {
        const pending = trackInflight.current.get(race.externalId);
        event = pending ? await pending : null;
      }
      if (!event) return;
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      toastRemovedFromTrackedEvents(label);
      refresh();
    } catch (e) {
      overrideTrack(race.externalId, true);
      toast.error("Could not remove this race from Tracked Events", {
        description: String(e),
      });
    }
  }

  async function trackAndBetRace(race: RacingFixture) {
    const event =
      myEvents.find((e) => e.externalId === race.externalId) ?? (await trackRace(race));
    if (variant === "dialog") closeTrackFixture();
    if (!event) {
      openAddBet(liveViewRacingAddBetPrefill(race));
      return;
    }
    openAddBet(liveViewRacingAddBetPrefill(race, event.id));
  }

  function addBetFromLiveRace(race: RacingFixture) {
    const tracked = myEvents.find((e) => e.externalId === race.externalId);
    if (variant === "dialog") closeTrackFixture();
    openAddBet(liveViewRacingAddBetPrefill(race, tracked?.id));
  }

  const myEvents = state?.events ?? [];
  const trackedExternalIds = useMemo(() => {
    const ids = new Set(
      myEvents.filter((event) => event.externalId).map((event) => event.externalId!)
    );
    for (const [externalId, on] of Object.entries(trackOverride)) {
      if (on) ids.add(externalId);
      else ids.delete(externalId);
    }
    return ids;
  }, [myEvents, trackOverride]);

  useEffect(() => {
    setTrackOverride((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let next: Record<string, boolean> | null = null;
      for (const [externalId, on] of Object.entries(prev)) {
        const actual = myEvents.some((event) => event.externalId === externalId);
        if (actual === on) {
          next ??= { ...prev };
          delete next[externalId];
        }
      }
      return next ?? prev;
    });
  }, [myEvents]);
  const canLiveRacing = canDesk(state?.settings, "racing_live_feeds");
  const racingLocked = fixtureSport === "horse_racing" && !canLiveRacing;

  const filteredFixtures = useMemo(() => sortFixturesByKickoff(fixtures), [fixtures]);
  const filteredRaces = useMemo(
    () => sortFixturesByKickoff(racingFixtures),
    [racingFixtures]
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

  const tabBleed = variant === "dialog" ? "dialog" : undefined;
  const displayTimezone = normalizeDisplayTimezone(state?.settings?.displayTimezone);

  const sportError = fixtureSport === "horse_racing" ? racingError : footballError;
  const emptyTitle = sportError
    ? fixtureSport === "horse_racing"
      ? "Could not load racecards"
      : "Could not load fixtures"
    : fixtureSport === "horse_racing"
      ? "No races on this day"
      : "No fixtures on this day";
  const emptyDescription = sportError
    ? "Reload the page, or try again in a moment."
    : fixtureSport === "horse_racing"
      ? "Finished races you tracked stay on Tracked Events. Try another day if you expected a card."
      : "Finished matches you tracked stay on Tracked Events. Try another day if you expected a match.";

  const hasSportData =
    fixtureSport === "horse_racing" ? racingFixtures.length > 0 : fixtures.length > 0;
  const sportReady =
    dayReady.day === listDay &&
    (fixtureSport === "horse_racing" ? dayReady.racing : dayReady.football);
  const showLoadingEmpty = !sportReady && !sportError;

  const dayStepper = racingLocked ? null : (
    <CalendarDayStepper
      day={listDay}
      onChange={(ymd) => {
        const next = clampCalendarYmd(ymd, dayBounds.min, dayBounds.max);
        if (next === listDay) return;
        setListDay(next);
        const hit = peekFixtureDay(next);
        const sportReadyNow =
          hit &&
          (fixtureSport === "horse_racing" ? hit.racingReady : hit.footballReady);
        if (hit && sportReadyNow) {
          applyDay(next, hit);
          return;
        }
        setFixtures([]);
        setRacingFixtures([]);
        setFootballError(null);
        setRacingError(null);
        setDayReady({ day: next, football: false, racing: false });
      }}
      min={dayBounds.min}
      max={dayBounds.max}
      busy={showLoadingEmpty}
      selectedLabel={formatFixtureStepperLabel(listDay, Date.now(), displayTimezone)}
      ariaLabel="Fixture day"
      pickAriaLabel="Pick fixture day"
      fromYear={Number(dayBounds.min.slice(0, 4))}
      toYear={Number(dayBounds.max.slice(0, 4))}
    />
  );

  const tabs = (
    <TabsLineBar
      bleed={tabBleed}
      className={cn(
        "w-full border-border",
        variant === "page" && "mt-4 [--tabs-line-inset:0px]",
        variant === "dialog" ? "mt-0" : undefined
      )}
    >
      <Tabs
        value={fixtureSport}
        onValueChange={(v) => persistFixtureSport(v as "football" | "horse_racing")}
        className="gap-0"
      >
        <TabsList
          variant="line"
          className="justify-start"
          fadeClassName={
            tabBleed === "dialog" ? "from-page dark:from-card" : "from-page"
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

  const board = racingLocked ? (
    <div className="flex min-w-0 flex-col">
      {header}
      {tabs}
      <div className="pt-4">
        <PlanLockEmpty feature="racing_live_feeds" />
      </div>
    </div>
  ) : (
    <DeskFixtureBoard
      sport={fixtureSport}
      football={filteredFixtures}
      competitions={competitions}
      racing={filteredRaces}
      trackedExternalIds={trackedExternalIds}
      onTrackFixture={trackFixture}
      onUntrackFixture={untrackFixture}
      onTrackAndBetFixture={trackAndBetFixture}
      onAddBetFixture={addBetFromLiveFixture}
      onEpDesk={openEpDesk}
      onTrackRace={trackRace}
      onUntrackRace={untrackRace}
      onTrackAndBetRace={trackAndBetRace}
      onAddBetRace={addBetFromLiveRace}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      loading={showLoadingEmpty}
      loadFailed={Boolean(sportError) && !hasSportData}
      displayTimezone={displayTimezone}
      emptyCompact={false}
      dayControl={dayStepper}
      listKey={listDay}
      sportControl={tabs}
      pageHeader={header}
    />
  );

  if (variant === "dialog") {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col px-6", className)}>
        {board}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {board}
    </div>
  );
}

/** Full-width fixture browser for the Fixtures page. */
export function FixtureBrowser({ header }: { header?: ReactNode }) {
  return <FixtureBrowserContent variant="page" header={header} />;
}
