"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { EventRowView } from "@/components/events/event-row-view";
import { ManualEventDialog } from "@/components/events/manual-event-dialog";
import { SimDialog } from "@/components/events/sim-dialog";
import { toastAddedToTrackedEvents } from "@/components/events/track-toast";
import { RacingSettlePrompt } from "@/components/racing/racing-settle-prompt";
import { api, useAppState } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { DatePicker, formatYmdLocal, parseYmdLocal } from "@/components/date-picker";
import { FilterPill } from "@/components/ui/filter-pill";
import { ListDaySection } from "@/components/layout/list-day-section";
import { PageHeaderButtonGroup, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { eventToPendingSettle, isEventPendingSettle } from "@/lib/racing/pending-settle";
import { racingSyncToast } from "@/lib/racing/sync-toast";
import {
  eventListDayBounds,
  eventListGroupDayMs,
  groupEventsByListDay,
  startOfLocalDay,
  type EventListDayFilter,
} from "@/lib/events/list-groups";
import { filterPillCountState } from "@/lib/ui/surface-styles";
import { formatPillLabel } from "@/lib/ui/status-badges";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { RefreshCw, Radio } from "lucide-react";

const DAY_FILTERS: EventListDayFilter[] = ["all", "today", "upcoming", "past"];

export default function TrackedEventsPage() {
  const router = useRouter();
  const { state, refresh } = useAppState(2000);
  const now = useNow(60_000);
  const [syncingRacing, setSyncingRacing] = useState(false);
  const [dayFilter, setDayFilter] = useState<EventListDayFilter>("all");
  const [jumpDay, setJumpDay] = useState("");

  const myEvents = useMemo(() => state?.events ?? [], [state?.events]);
  const linkedBets = useMemo(() => state?.bets ?? [], [state?.bets]);
  const promoAwards = state?.promoAwards ?? {};
  const liveModelsById = useMemo(
    () => new Map((state?.liveEventModels ?? []).map((m) => [m.eventId, m])),
    [state?.liveEventModels]
  );

  const pendingRacingEvents = useMemo(
    () => myEvents.filter(isEventPendingSettle),
    [myEvents]
  );

  const hasFetchableRacing = useMemo(
    () =>
      myEvents.some(
        (e) => e.sport === "horse_racing" && !!e.externalId?.trim()
      ),
    [myEvents]
  );

  const pendingSettleRaces = useMemo(
    () => pendingRacingEvents.map(eventToPendingSettle),
    [pendingRacingEvents]
  );

  const eventDayYmds = useMemo(() => {
    const days = new Set<string>();
    for (const event of myEvents) {
      days.add(formatYmdLocal(new Date(event.startTime)));
    }
    return days;
  }, [myEvents]);

  const jumpDayMs = useMemo(() => {
    if (!jumpDay) return null;
    const parsed = parseYmdLocal(jumpDay);
    return parsed ? startOfLocalDay(parsed.getTime()) : null;
  }, [jumpDay]);

  const filterCounts = useMemo(() => {
    const today = startOfLocalDay(now);
    let todayCount = 0;
    let upcomingCount = 0;
    let pastCount = 0;
    for (const event of myEvents) {
      const day = eventListGroupDayMs(event);
      if (day === today) todayCount += 1;
      else if (day > today) upcomingCount += 1;
      else pastCount += 1;
    }
    return { today: todayCount, upcoming: upcomingCount, past: pastCount };
  }, [myEvents, now]);

  const grouped = useMemo(() => {
    if (jumpDayMs != null) {
      return groupEventsByListDay(myEvents, { now, dayMs: jumpDayMs });
    }
    return groupEventsByListDay(myEvents, { now, ...eventListDayBounds(dayFilter, now) });
  }, [myEvents, now, dayFilter, jumpDayMs]);

  const pickerYearRange = useMemo(() => {
    if (eventDayYmds.size === 0) {
      const year = new Date(now).getFullYear();
      return { fromYear: year, toYear: year };
    }
    const years = [...eventDayYmds].map((ymd) => Number(ymd.slice(0, 4)));
    return { fromYear: Math.min(...years), toYear: Math.max(...years) };
  }, [eventDayYmds, now]);

  const syncRacingResults = useCallback(async () => {
    setSyncingRacing(true);
    try {
      const result = await api<{
        updated: number;
        pending: number;
        tierBlocked?: boolean;
        historicBlocked?: boolean;
        tier?: "basic" | "free" | "none";
      }>("/api/racing/sync-results?force=1", {
        method: "POST",
      });
      await refresh();
      const msg = racingSyncToast(result);
      if (msg.kind === "success") {
        toast.success(msg.title, msg.description ? { description: msg.description } : undefined);
      } else {
        toast.info(msg.title, msg.description ? { description: msg.description } : undefined);
      }
    } catch (e) {
      toast.error("Racing sync failed", { description: String(e) });
    } finally {
      setSyncingRacing(false);
    }
  }, [refresh]);

  async function startSim(preset: string, stars: { homeStar?: string; awayStar?: string }) {
    const names: Record<string, [string, string]> = {
      two_up_drama: ["Simulated United", "Comeback City"],
      btts_thriller: ["Goals FC", "Chaos Athletic"],
      bore_draw: ["Sleepy Town", "Cagey Rovers"],
      random: ["Random Rangers", "Dice United"],
    };
    const [home, away] = names[preset] ?? names.random;
    try {
      await api("/api/events", {
        method: "POST",
        json: {
          homeTeam: home,
          awayTeam: away,
          competition: "Simulation",
          source: "sim",
          simPreset: preset,
          simStars: stars,
        },
      });
      toastAddedToTrackedEvents(`${home} v ${away}`, () => router.push("/tracked-events"));
      refresh();
    } catch (e) {
      toast.error("Could not start simulation", { description: String(e) });
    }
  }

  async function patchEvent(id: number, json: Record<string, unknown>) {
    try {
      await api(`/api/events/${id}`, { method: "PATCH", json });
      refresh();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  async function deleteEvent(id: number) {
    try {
      await api(`/api/events/${id}`, { method: "DELETE" });
      toast.success("Removed from Tracked Events");
      refresh();
    } catch (e) {
      toast.error("Delete failed", { description: String(e) });
    }
  }

  function selectDayFilter(next: EventListDayFilter) {
    setJumpDay("");
    setDayFilter(next);
  }

  const filteredEmpty = myEvents.length > 0 && grouped.length === 0;

  return (
    <TooltipProvider delayDuration={200}>
    <PageShell>
      <PageHeader
        helpId="tracked-events"
        title="Tracked Events"
        description={
          <>
            Matches and races you&apos;re following, grouped by kick-off day. Live scores
            refresh automatically (~once a minute). Add more from the{" "}
            <Link href="/fixtures" className="text-primary-text underline-offset-2 hover:underline">
              Fixtures
            </Link>{" "}
            browser.
          </>
        }
        action={
          <PageHeaderButtonGroup>
            {hasFetchableRacing && (
              <Button
                variant="outline"
                {...pageSecondaryButtonProps}
                disabled={syncingRacing}
                onClick={syncRacingResults}
                className="gap-1.5"
              >
                <RefreshCw className={syncingRacing ? "size-3.5 animate-spin" : "size-3.5"} />
                Sync racing results
              </Button>
            )}
            <SimDialog onStart={startSim} />
            <ManualEventDialog onSaved={refresh} />
          </PageHeaderButtonGroup>
        }
        toolbar={
          myEvents.length > 0 ? (
            <>
              {DAY_FILTERS.map((f) => {
                const count =
                  f === "today"
                    ? filterCounts.today
                    : f === "upcoming"
                      ? filterCounts.upcoming
                      : f === "past"
                        ? filterCounts.past
                        : 0;
                const hasCount = count > 0;
                return (
                  <FilterPill
                    key={f}
                    active={jumpDayMs == null && dayFilter === f}
                    onClick={() => selectDayFilter(f)}
                    hasCount={hasCount}
                  >
                    {formatPillLabel(f)}
                    {hasCount ? (
                      <span className={filterPillCountState(jumpDayMs == null && dayFilter === f)}>
                        {count}
                      </span>
                    ) : null}
                  </FilterPill>
                );
              })}
              <DatePicker
                value={jumpDay}
                onChange={setJumpDay}
                placeholder="Jump to day"
                tone="toolbar"
                allowClear
                aria-label="Jump to day"
                hint="Only days with tracked events can be picked."
                fromYear={pickerYearRange.fromYear}
                toYear={pickerYearRange.toYear}
                isDayDisabled={(date) => !eventDayYmds.has(formatYmdLocal(date))}
              />
            </>
          ) : null
        }
      />

      {pendingSettleRaces.length > 0 && (
        <RacingSettlePrompt
          races={pendingSettleRaces}
          resultsTier={state?.racingResultsTier}
        />
      )}

      <div className="flex flex-col gap-8">
        {state == null ? (
          <EmptyState
            busy
            icon={Radio}
            title="Loading tracked events…"
            description="Your matches and races will appear here."
          />
        ) : myEvents.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="Nothing tracked yet"
            description="Browse fixtures and hit + on a match or race, simulate a 2UP demo match, or add a manual event."
            action={{ label: "Browse fixtures", href: "/fixtures" }}
            secondaryAction={{ label: "Getting started", href: "/help?guide=getting-started" }}
          />
        ) : filteredEmpty ? (
          <EmptyState
            icon={Radio}
            title={
              jumpDayMs != null
                ? "No tracked events on this day"
                : dayFilter === "today"
                  ? "Nothing tracked today"
                  : dayFilter === "upcoming"
                    ? "No upcoming events"
                    : dayFilter === "past"
                      ? "No past events"
                      : "No tracked events"
            }
            description={
              jumpDayMs != null
                ? "Pick another day, or switch to All to see every tracked event."
                : "Switch to All, or jump to a day that still has events."
            }
            action={{ label: "Show all days", onClick: () => selectDayFilter("all") }}
          />
        ) : (
          grouped.map((group) => {
            const headingId = `tracked-day-${group.dayMs}`;
            return (
              <ListDaySection key={group.dayMs} label={group.label} headingId={headingId}>
                <TrackedEventsDayTable
                  labelledBy={headingId}
                  events={group.events}
                  linkedBets={linkedBets}
                  promoAwards={promoAwards}
                  liveModelsById={liveModelsById}
                  onPatch={patchEvent}
                  onDelete={deleteEvent}
                />
              </ListDaySection>
            );
          })
        )}
      </div>
    </PageShell>
    </TooltipProvider>
  );
}

function TrackedEventsDayTable({
  labelledBy,
  events,
  linkedBets,
  promoAwards,
  liveModelsById,
  onPatch,
  onDelete,
}: {
  labelledBy: string;
  events: EventRow[];
  linkedBets: BetRow[];
  promoAwards: PromoAwardsByBetId;
  liveModelsById: Map<number, { marketsLabel: string }>;
  onPatch: (id: number, json: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardContent className="min-w-0 overflow-x-auto">
        <Table aria-labelledby={labelledBy}>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-36">Result</TableHead>
              <TableHead className="w-52 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <EventRowView
                key={event.id}
                event={event}
                linkedBets={linkedBets.filter((b) => b.eventId === event.id)}
                promoAwards={promoAwards}
                liveModel={liveModelsById.get(event.id) ?? null}
                onPatch={onPatch}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
