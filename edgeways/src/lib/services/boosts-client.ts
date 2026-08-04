import type { BetRow, BoostDiaryRow } from "@/lib/db/schema";

export type BoostDiaryStage = "logged" | "placed";

export type BoostLinkedBet = Pick<
  BetRow,
  | "id"
  | "status"
  | "actualProfit"
  | "expectedProfit"
  | "backStake"
  | "backOdds"
  | "layStake"
  | "layOdds"
  | "commission"
  | "bookmaker"
  | "exchangeId"
  | "label"
>;

export type BoostDiaryEntry = BoostDiaryRow & {
  stage: BoostDiaryStage;
  linkedBet: BoostLinkedBet | null;
};

/** Fields Add bet needs when placing from a diary row (J2b). */
export type BoostAddBetPrefill = {
  label: string;
  bookmaker?: string;
  backStake: number;
  backOdds: number;
  layOdds?: number;
  layStake?: number;
  exchangeId?: number;
  boostDiaryId: number;
  betType: "boost";
  /** Sport/event/date/time are unknown at boost check time. */
  omitEventDefaults: true;
};

/** Build Add bet prefill from a boost diary row (safe for client components). */
export function boostDiaryToAddBetPrefill(entry: BoostDiaryRow): BoostAddBetPrefill {
  return {
    label: entry.label,
    bookmaker: entry.bookmaker ?? undefined,
    backStake: entry.stake,
    backOdds: entry.boostedOdds,
    layOdds: entry.layOdds ?? undefined,
    layStake: entry.layStake ?? undefined,
    exchangeId: entry.exchangeId ?? undefined,
    boostDiaryId: entry.id,
    betType: "boost",
    omitEventDefaults: true,
  };
}

export type BoostDiaryQueue = "all" | "logged" | "placed";

export const BOOST_DIARY_QUEUES: { id: BoostDiaryQueue; label: string }[] = [
  { id: "all", label: "All" },
  { id: "logged", label: "Logged" },
  { id: "placed", label: "Placed" },
];

export function boostDiaryStage(entry: Pick<BoostDiaryRow, "betId">): BoostDiaryStage {
  return entry.betId != null ? "placed" : "logged";
}

export function filterBoostDiaryByQueue<T extends Pick<BoostDiaryRow, "betId">>(
  entries: T[],
  queue: BoostDiaryQueue
): T[] {
  if (queue === "all") return entries;
  if (queue === "logged") return entries.filter((e) => e.betId == null);
  return entries.filter((e) => e.betId != null);
}
