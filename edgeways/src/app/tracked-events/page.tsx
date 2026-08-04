"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { eventToPendingSettle, isEventPendingSettle } from "@/lib/racing/pending-settle";
import { racingSyncToast } from "@/lib/racing/sync-toast";
import { RefreshCw, Radio } from "lucide-react";

export default function TrackedEventsPage() {
  const router = useRouter();
  const { state, refresh } = useAppState(2000);
  const [syncingRacing, setSyncingRacing] = useState(false);

  const myEvents = state?.events ?? [];
  const linkedBets = state?.bets ?? [];
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

  /** Latest kick-off first so Upcoming sits above Live/Finished. */
  const sortedEvents = useMemo(
    () => [...myEvents].sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0)),
    [myEvents]
  );

  const syncRacingResults = useCallback(async () => {
    setSyncingRacing(true);
    try {
      const result = await api<{
        updated: number;
        pending: number;
        tierBlocked?: boolean;
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

  return (
    <TooltipProvider delayDuration={200}>
    <PageShell>
      <PageHeader
        helpId="tracked-events"
        title="Tracked Events"
        description={
          <>
            Matches and races you&apos;re following - live scores refresh automatically (~once a
            minute). Add more from the{" "}
            <Link href="/fixtures" className="text-primary underline-offset-2 hover:underline">
              Fixtures
            </Link>{" "}
            browser.
          </>
        }
        action={
          <>
            <SimDialog onStart={startSim} />
            <ManualEventDialog onSaved={refresh} />
          </>
        }
      />

      {pendingSettleRaces.length > 0 && (
        <RacingSettlePrompt
          races={pendingSettleRaces}
          resultsTier={state?.racingResultsTier}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle section>Your tracked list</CardTitle>
              <CardDescription>
                Live feed matches update score and minute from API-Football. Goal timelines only
                fetch when you have an open trigger bet on the match.
                {state?.racingResultsTier === "basic" ? (
                  <> Racing results sync automatically while the app is open.</>
                ) : pendingRacingEvents.length > 0 ? (
                  <>
                    {" "}
                    {pendingRacingEvents.length} race
                    {pendingRacingEvents.length === 1 ? "" : "s"} need a result - use{" "}
                    <span className="font-medium text-foreground">Set result</span> (1st–4th) for
                    place-refund free bets. No paid API required.
                  </>
                ) : null}
              </CardDescription>
            </div>
            {hasFetchableRacing && (
              <Button
                variant="outline"
                size="sm"
                disabled={syncingRacing}
                onClick={syncRacingResults}
                className="shrink-0 gap-1.5"
              >
                <RefreshCw className={syncingRacing ? "size-3.5 animate-spin" : "size-3.5"} />
                Sync racing results
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {myEvents.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="Nothing tracked yet"
              description="Browse fixtures and hit + on a match or race, simulate a 2UP demo match, or add a manual event."
              action={{ label: "Browse fixtures", href: "/fixtures" }}
              secondaryAction={{ label: "Getting started", href: "/help?guide=getting-started" }}
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36">Result</TableHead>
                <TableHead className="w-52 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.map((event) => (
                <EventRowView
                  key={event.id}
                  event={event}
                  linkedBets={linkedBets.filter((b) => b.eventId === event.id)}
                  promoAwards={promoAwards}
                  liveModel={liveModelsById.get(event.id) ?? null}
                  onPatch={patchEvent}
                  onDelete={deleteEvent}
                />
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
    </TooltipProvider>
  );
}
