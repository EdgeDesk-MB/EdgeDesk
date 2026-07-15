/**
 * The Daily Plan (B1) - one time-ordered run-sheet for today merging offer
 * next-actions (timed by today's deadline), tracked race off times, fixture
 * kickoffs for open bets, and untimed Do Next work as an "anytime" bucket.
 *
 * Product rule: completed/impossible slots COLLAPSE (the component renders
 * them muted) but never reorder - the user's mental model stays stable while
 * the plan regenerates on every state poll.
 */

import type { OfferSummary } from "@/lib/services/offers.types";
import type { DoNextItem } from "@/lib/offers/do-next";
import type { EvBasis } from "@/lib/offers/advantage";
import {
  priorityFromSignals,
  type OfferCalendarPriority,
} from "@/lib/offers/offer-calendar";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";

export type DailyPlanSlotKind = "offer_action" | "race" | "kickoff" | "anytime";

export interface DailyPlanRaceInput {
  eventId: number;
  course: string;
  /** Off time, epoch ms */
  offTime: number;
  resultLogged: boolean;
  /** Sum of expectedProfit across open bets on this race */
  openExpected: number | null;
  /** Whether any bet is logged on this race (alert rules use it; plan ignores it) */
  hasOpenBet?: boolean;
}

export interface DailyPlanFixtureInput {
  eventId: number;
  /** Kickoff, epoch ms */
  kickoff: number;
  label: string;
  betCount: number;
  openBetCount: number;
  openExpected: number | null;
}

export interface DailyPlanSlot {
  /** Stable across rebuilds so React never remounts on poll refresh */
  id: string;
  /** Epoch ms, or null for the anytime bucket */
  at: number | null;
  kind: DailyPlanSlotKind;
  /** For offer-derived slots: the underlying Do Next kind (drives accent colour). */
  doKind?: DoNextItem["kind"];
  title: string;
  detail: string | null;
  ev?: number;
  basis?: EvBasis;
  priority: OfferCalendarPriority;
  href: string | null;
  done: boolean;
}

export interface DailyPlanInput {
  offers: OfferSummary[];
  doNext: DoNextItem[];
  races: DailyPlanRaceInput[];
  fixtures: DailyPlanFixtureInput[];
  now?: number;
}

function todayWindow(now: number): { start: number; end: number } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function sortSlots(slots: DailyPlanSlot[]): DailyPlanSlot[] {
  return [...slots].sort((a, b) => {
    if (a.at == null && b.at == null) return 0; // anytime keeps input (ranked) order
    if (a.at == null) return 1;
    if (b.at == null) return -1;
    if (a.at !== b.at) return a.at - b.at;
    return a.id.localeCompare(b.id);
  });
}

export function buildDailyPlan(input: DailyPlanInput): DailyPlanSlot[] {
  const { offers, doNext, races, fixtures } = input;
  const now = input.now ?? Date.now();
  const { start, end } = todayWindow(now);
  const offersById = new Map(offers.map((o) => [o.id, o]));
  const slots: DailyPlanSlot[] = [];

  const todayKey = localYmd(new Date(now));

  // One slot per action+campaign: course siblings and backfill duplicates
  // share a title, and the plan is a run-sheet, not an inventory.
  const seenActionKeys = new Set<string>();

  for (const item of doNext) {
    if (item.kind === "await_result") continue;

    const offer = item.offerId != null ? offersById.get(item.offerId) : undefined;
    // Today's sheet only: recurring instances materialised for future days
    // would otherwise flood the anytime bucket with duplicates.
    if (offer?.instanceDate && offer.instanceDate !== todayKey) continue;
    // Same rule for event-dated offers: Saturday's racing offer belongs to
    // Saturday's sheet, not today's anytime bucket.
    if (offer?.eventDate && offer.eventDate > todayKey) continue;

    const dedupeKey = `${item.kind}:${(item.offerTitle ?? item.title).trim().toLowerCase()}`;
    if (seenActionKeys.has(dedupeKey)) continue;
    seenActionKeys.add(dedupeKey);

    const deadline = offer ? effectiveOfferExpiryMs(offer) : null;
    const timed = deadline != null && deadline >= start && deadline < end;
    const priority = priorityFromSignals({
      kind: "action",
      daysLeft: item.daysLeft,
      advantageScore: item.edgeScore,
      actionPriority: item.priority,
    });

    slots.push({
      id: item.id,
      at: timed ? deadline : null,
      kind: timed ? "offer_action" : "anytime",
      doKind: item.kind,
      title: item.title,
      // Campaign name first: four "Place qualifying bet" rows are useless
      // unless each says WHICH offer it belongs to.
      detail: item.offerTitle || item.detail,
      ev: item.remainingEv > 0 ? item.remainingEv : undefined,
      basis: item.basis,
      priority,
      href: item.href,
      done: false,
    });
  }

  for (const r of races) {
    if (r.offTime < start || r.offTime >= end) continue;
    slots.push({
      id: `race-${r.eventId}`,
      at: r.offTime,
      kind: "race",
      title: r.course,
      detail: "Race off",
      ev: r.openExpected != null && r.openExpected > 0 ? r.openExpected : undefined,
      basis: r.openExpected != null && r.openExpected > 0 ? "estimated" : undefined,
      priority: "medium",
      href: "/racing",
      done: r.resultLogged || r.offTime < now,
    });
  }

  for (const f of fixtures) {
    if (f.kickoff < start || f.kickoff >= end) continue;
    slots.push({
      id: `kickoff-${f.eventId}`,
      at: f.kickoff,
      kind: "kickoff",
      title: f.label,
      detail: "Kick-off",
      ev: f.openExpected != null && f.openExpected > 0 ? f.openExpected : undefined,
      basis: f.openExpected != null && f.openExpected > 0 ? "estimated" : undefined,
      priority: "medium",
      href: "/tracker",
      done: f.betCount > 0 && f.openBetCount === 0,
    });
  }

  return sortSlots(slots);
}

/**
 * Session merge: a slot the rebuild no longer produces was completed (or
 * became impossible) - keep it visible as done at its old position instead of
 * letting the sheet shuffle underneath the user.
 */
export function mergePlanWithSeen(
  previous: DailyPlanSlot[],
  next: DailyPlanSlot[]
): DailyPlanSlot[] {
  const nextById = new Map(next.map((s) => [s.id, s]));
  const merged: DailyPlanSlot[] = [];

  for (const prev of previous) {
    const fresh = nextById.get(prev.id);
    if (fresh) {
      merged.push(fresh);
      nextById.delete(prev.id);
    } else {
      merged.push({ ...prev, done: true });
    }
  }
  for (const added of nextById.values()) merged.push(added);

  return sortSlots(merged);
}
