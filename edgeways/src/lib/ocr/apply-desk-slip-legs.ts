/**
 * Map parsed multiples / acca slip legs onto Acca Desk drafts:
 * horse → Selection, Win - 15:00 York → Event.
 */

import type { KnownFixtureOption } from "@/lib/add-bet-event-options";
import { matchOcrToRunner } from "@/lib/ocr/match-runner";
import { matchOcrRacingSlip } from "@/lib/ocr/match-event";
import type { SlipLeg } from "@/lib/ocr/types";
import { toDatetimeLocalValue } from "@/lib/offers/offer-terms";
import { MARKETS } from "@/lib/markets";
import { isRacingSport } from "@/lib/sports";

export type DeskSlipEventLike = {
  id: number;
  sport?: string | null;
  status?: string | null;
  competition?: string | null;
  course?: string | null;
  startTime?: number | null;
  awayTeam?: string | null;
  offTime?: string | null;
};

export type DeskSlipLegDraft = {
  label: string;
  backOdds: number;
  scheduledAt: string;
  sport: string;
  eventId: number | null;
  pendingFixture: KnownFixtureOption | null;
  market: string;
  selection: string;
};

function defaultMarketForSport(sport: string): string {
  return MARKETS[sport]?.[0]?.value ?? "other";
}

function scheduledAtFromHint(
  startTime: number | null | undefined,
  eventTime: string | undefined
): string {
  if (startTime != null && Number.isFinite(startTime)) {
    return toDatetimeLocalValue(startTime);
  }
  if (!eventTime?.match(/^\d{1,2}:\d{2}$/)) return "";
  const [h, m] = eventTime.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return toDatetimeLocalValue(d.getTime());
}

function racingMarket(leg: SlipLeg): string {
  if (leg.market === "place") return "place";
  if (leg.market === "each_way") return "each_way";
  return "win";
}

export function deskLegDraftFromSlipLeg(
  leg: SlipLeg,
  opts: {
    events: readonly DeskSlipEventLike[];
    fixtures: readonly KnownFixtureOption[];
    seedSport: string;
  }
): DeskSlipLegDraft {
  const racing = Boolean(leg.course || leg.eventTime || isRacingSport(opts.seedSport));
  const sport = racing ? "horse_racing" : opts.seedSport || "football";
  const market = racing ? racingMarket(leg) : defaultMarketForSport(sport);
  const tracked = racing
    ? matchOcrRacingSlip(leg, opts.events)
    : undefined;
  const fixture =
    !tracked && racing ? matchOcrRacingSlip(leg, opts.fixtures) : undefined;

  const runners = fixture?.runners ?? [];
  const runner = matchOcrToRunner(leg.label, runners)?.runner ?? leg.label.trim();

  return {
    label: runner,
    backOdds: leg.odds != null && leg.odds > 1 ? leg.odds : NaN,
    scheduledAt: scheduledAtFromHint(
      tracked?.startTime ?? fixture?.startTime ?? null,
      leg.eventTime
    ),
    sport,
    eventId: tracked?.id ?? null,
    pendingFixture: tracked ? null : (fixture ?? null),
    market,
    selection: runner,
  };
}

export function deskLegsFromOcrSlip(
  legs: SlipLeg[],
  opts: {
    events: readonly DeskSlipEventLike[];
    fixtures: readonly KnownFixtureOption[];
    seedSport: string;
  }
): DeskSlipLegDraft[] {
  return legs.map((leg) => deskLegDraftFromSlipLeg(leg, opts));
}
