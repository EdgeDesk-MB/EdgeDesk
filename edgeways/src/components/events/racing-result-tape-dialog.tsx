"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { EmptyState } from "@/components/help/empty-state";
import { RegionFlag } from "@/components/region-flag";
import type { RacingFixture } from "@/components/events/types";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { formatPositionOrdinal } from "@/lib/racing";
import { formatSpOddsDisplay } from "@/lib/racing/odds";
import { racingRegionLabel } from "@/lib/geo/region";
import { formatRacingOffTime } from "@/lib/events";
import { formatClockString, formatClockTime } from "@/lib/time-format";
import {
  captionHeading,
  deskTableBodyCell,
  deskTableHeaderCell,
  deskTableHeaderRowSticky,
  dialogDescription,
  dialogTitle,
  listRow,
  listRowGroup,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { HorseRacingIcon } from "@/components/sport-icon";
import { NotebookPen, Plus } from "lucide-react";

/** Match the header / footer inset (24px), not Racing Desk table edges. */
const tapeEdgeStart = "pl-6";
const tapeEdgeEnd = "pr-6";

type ResultRow = {
  horse: string;
  position: number;
  sp: string;
  dist: string | null;
};

function resultRows(race: RacingFixture): ResultRow[] {
  if (race.result?.runners.length) {
    return [...race.result.runners]
      .filter((r) => r.horse)
      .sort((a, b) => {
        if (a.position > 0 && b.position > 0) return a.position - b.position;
        if (a.position > 0) return -1;
        if (b.position > 0) return 1;
        return a.horse.localeCompare(b.horse);
      })
      .map((r) => ({
        horse: r.horse,
        position: r.position,
        sp: formatSpOddsDisplay(
          {
            spFraction: r.spLabel,
            spDecimal: r.spDecimal,
            isSpFavourite: r.isSpFavourite,
          },
          { decimal: true }
        ),
        dist: r.position === 1 ? null : r.btn?.trim() || null,
      }));
  }
  const details = race.runnerDetails?.filter((r) => !r.nonRunner && r.name) ?? [];
  if (details.length) {
    return details.map((r) => ({
      horse: r.name,
      position: 0,
      sp: formatSpOddsDisplay(
        { spFraction: r.spFraction, spDecimal: r.spDecimal },
        { decimal: true }
      ),
      dist: null,
    }));
  }
  return race.runners.map((horse) => ({
    horse,
    position: 0,
    sp: "–",
    dist: null,
  }));
}

export function RacingResultTapeDialog({
  race,
  open,
  onOpenChange,
  tracked,
  displayTimezone,
  onTrack,
  onAddBet,
}: {
  race: RacingFixture;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracked?: boolean;
  displayTimezone: string;
  onTrack?: () => void;
  onAddBet?: () => void;
}) {
  const router = useRouter();
  const rows = resultRows(race);
  const finished = race.status === "finished" || Boolean(race.result);
  const showAddBet = Boolean(onAddBet) && !finished;
  const showDist = finished && rows.some((r) => r.dist);
  const clock = finished
    ? "Result"
    : race.status === "live"
      ? "Off"
      : formatClockTime(race.startTime, { timeZone: displayTimezone });
  const courseLabel = `${racingRegionLabel(race.region).toUpperCase()} · ${race.course.toUpperCase()}`;
  const offClock = race.offTime
    ? formatClockString(formatRacingOffTime(race.offTime))
    : "";
  const summary = [
    finished && race.winner ? `Won by ${race.winner}` : null,
    `${race.fieldSize} runners`,
    offClock || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex! min-h-0 max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 max-sm:overflow-hidden max-sm:pb-0 sm:h-[min(40rem,85dvh)] sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <div className="shrink-0 bg-card">
          <DialogHeader className="relative mx-0 mt-0 bg-transparent px-6 pr-6">
            <p className={cn(captionHeading, "flex min-w-0 items-center gap-2")}>
              {race.region ? (
                <RegionFlag code={race.region} size="sm" />
              ) : (
                <HorseRacingIcon size={14} className="text-muted-foreground" />
              )}
              <span className="min-w-0 text-pretty break-words">{courseLabel}</span>
            </p>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <DialogTitle className={dialogTitle}>{race.raceName}</DialogTitle>
              <p
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  race.status === "live" ? "text-profit" : "text-muted-foreground"
                )}
              >
                {clock}
              </p>
            </div>
            <DialogDescription className={dialogDescription}>{summary}</DialogDescription>
          </DialogHeader>
        </div>
        <ScrollFadeEdges
          className="min-h-0 flex-1 bg-page"
          fadeClassName="from-page"
          startFade={false}
          overlayScrollbar
          scrollClassName="app-scroll-float overscroll-contain"
        >
          {rows.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-6 py-8">
              <EmptyState
                bare
                compact
                oneLine
                icon={HorseRacingIcon}
                title={finished ? "No result yet" : "No runners listed"}
                description={
                  finished
                    ? "The finishing order will appear here when the card is in."
                    : "This race has no declared runners in the card."
                }
              />
            </div>
          ) : (
            <div className="pb-6">
              <table className="w-full min-w-0 border-collapse text-sm">
                <thead>
                  <tr className={deskTableHeaderRowSticky}>
                    {finished ? (
                      <th className={cn(deskTableHeaderCell, tapeEdgeStart, "w-12 text-left")}>
                        Pos
                      </th>
                    ) : null}
                    <th className={cn(deskTableHeaderCell, !finished && tapeEdgeStart, "text-left")}>
                      Horse
                    </th>
                    {showDist ? (
                      <th className={cn(deskTableHeaderCell, "w-16 text-right")}>
                        Dist
                      </th>
                    ) : null}
                    <th className={cn(deskTableHeaderCell, tapeEdgeEnd, "w-20 text-right")}>
                      SP
                    </th>
                  </tr>
                </thead>
                <tbody className={listRowGroup}>
                  {rows.map((row) => (
                    <tr key={`${row.position}-${row.horse}`} className={listRow}>
                      {finished ? (
                        <td className={cn(deskTableBodyCell, tapeEdgeStart, "tabular-nums")}>
                          {formatPositionOrdinal(row.position) ?? "–"}
                        </td>
                      ) : null}
                      <td
                        className={cn(
                          deskTableBodyCell,
                          "min-w-0 font-medium",
                          !finished && tapeEdgeStart
                        )}
                      >
                        {row.horse}
                      </td>
                      {showDist ? (
                        <td className={cn(deskTableBodyCell, "text-right tabular-nums text-muted-foreground")}>
                          {row.dist ?? "–"}
                        </td>
                      ) : null}
                      <td className={cn(deskTableBodyCell, tapeEdgeEnd, "text-right tabular-nums")}>
                        {row.sp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollFadeEdges>
        {onTrack || showAddBet ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col bg-page px-6 dark:bg-card max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end">
            {onTrack && !tracked ? (
              <Button
                type="button"
                variant="outline"
                {...pageSecondaryButtonProps}
                onClick={onTrack}
              >
                <Plus className="size-4" aria-hidden />
                Track
              </Button>
            ) : tracked ? (
              <Button
                type="button"
                variant="outline"
                {...pageSecondaryButtonProps}
                onClick={() => {
                  onOpenChange(false);
                  router.push("/tracked-events");
                }}
              >
                Tracked
              </Button>
            ) : null}
            {showAddBet ? (
              <Button type="button" {...pagePrimaryButtonProps} onClick={onAddBet}>
                <NotebookPen className="size-4" aria-hidden />
                Add bet
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
