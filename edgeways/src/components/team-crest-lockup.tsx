"use client";

import { TeamCrest } from "@/components/team-crest";
import { cn } from "@/lib/utils";

export type TeamCrestLockupSize = "feed" | "history";
export type TeamCrestLockupPlate = "page" | "card";

const WELL: Record<TeamCrestLockupSize, string> = {
  feed: "size-7",
  history: "size-10",
};

const CREST: Record<TeamCrestLockupSize, string> = {
  feed: "size-5",
  history: "size-7",
};

const RING: Record<TeamCrestLockupPlate, string> = {
  page: "ring-page",
  card: "ring-card",
};

/**
 * Livescore-style pair: home top-left, away bottom-right, overlapping
 * circles with a plate ring so both marks stay readable.
 */
export function TeamCrestLockup({
  homeSrc,
  awaySrc,
  size = "feed",
  plate = "page",
  reserve = false,
  className,
}: {
  homeSrc?: string | null;
  awaySrc?: string | null;
  size?: TeamCrestLockupSize;
  /** Cut-out colour: Home live rows sit on `--page`; History cards on `--card`. */
  plate?: TeamCrestLockupPlate;
  /** Keep the well while logos load so the right rail does not jump. */
  reserve?: boolean;
  className?: string;
}) {
  const hasHome = Boolean(homeSrc);
  const hasAway = Boolean(awaySrc);
  if (!hasHome && !hasAway && !reserve) return null;

  const crest = CREST[size];
  const ring = cn(
    "overflow-hidden rounded-full bg-card ring-1",
    RING[plate],
    crest
  );

  return (
    <span
      className={cn("relative isolate z-0 shrink-0", WELL[size], className)}
      aria-hidden
    >
      {hasHome && hasAway ? (
        <>
          <span className={cn("absolute top-0 left-0", ring)}>
            <TeamCrest src={homeSrc} alt="" size="fill" />
          </span>
          <span className={cn("absolute right-0 bottom-0 z-[1]", ring)}>
            <TeamCrest src={awaySrc} alt="" size="fill" />
          </span>
        </>
      ) : hasHome || hasAway ? (
        <span className={cn("absolute inset-0 m-auto", ring)}>
          <TeamCrest src={homeSrc ?? awaySrc} alt="" size="fill" />
        </span>
      ) : null}
    </span>
  );
}
