/** Offer category taxonomy - maps UI category ↔ `offers.sport`. */

import { isKnownSport, isRacingSport, SPORTS, sportDisplayLabel, type SportValue } from "@/lib/sports";

export type OfferCategoryId = "general" | "casino" | SportValue;

export interface OfferCategoryDef {
  id: OfferCategoryId;
  label: string;
  /** Stored in offers.sport; null = general / unset */
  sport: string | null;
  /** Show racing place-refund fields */
  isRacing: boolean;
}

const SPORT_CATEGORIES: OfferCategoryDef[] = SPORTS.filter((s) => s.value !== "other").map(
  (s) => ({
    id: s.value,
    label: s.label,
    sport: s.value,
    isRacing: isRacingSport(s.value),
  })
);

export const OFFER_CATEGORIES: OfferCategoryDef[] = [
  { id: "general", label: "General", sport: null, isRacing: false },
  ...SPORT_CATEGORIES,
  { id: "casino", label: "Casino", sport: "casino", isRacing: false },
];

const BY_ID = Object.fromEntries(OFFER_CATEGORIES.map((c) => [c.id, c])) as Record<
  OfferCategoryId,
  OfferCategoryDef
>;

/** Legacy ids from the old 5-bucket picker. */
export function normalizeOfferCategoryId(id: string | null | undefined): OfferCategoryId {
  if (!id) return "general";
  if (id === "racing") return "horse_racing";
  if (id === "sports") return "general";
  if (id in BY_ID) return id as OfferCategoryId;
  if (isKnownSport(id)) return id;
  return "general";
}

export function offerCategoryById(id: OfferCategoryId | string): OfferCategoryDef {
  return BY_ID[normalizeOfferCategoryId(id)] ?? BY_ID.general;
}

export function offerCategoryFromSport(sport: string | null | undefined): OfferCategoryId {
  if (!sport) return "general";
  if (sport === "casino") return "casino";
  if (sport === "sports") return "general";
  if (isKnownSport(sport)) return sport;
  if (isRacingSport(sport)) return "horse_racing";
  return "general";
}

export function sportFromOfferCategory(id: OfferCategoryId | string): string | null {
  return offerCategoryById(id).sport;
}

export function offerCategoryLabel(sport: string | null | undefined): string {
  if (!sport) return offerCategoryById("general").label;
  if (sport === "sports") return "Sports";
  const category = offerCategoryFromSport(sport);
  return offerCategoryById(category).label;
}
