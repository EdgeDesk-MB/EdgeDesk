/**
 * K1 - Zod discriminated union for a casino offer component, keyed on
 * `componentType`. Each branch validates only the fields that type's calc
 * function actually reads (see `deriveComponentEv` in
 * `src/lib/calc/casino-reward-ev.ts`) - a `cash` component posting a `spins`
 * field, for example, has it silently stripped by Zod's default object
 * parsing, then `toComponentRowValues` below guarantees it's never written
 * to the row regardless (every branch nulls every field its type doesn't use).
 *
 * Used identically for POST (create) and PATCH (edit, full replace of the
 * type-specific fields - simpler and safer than a partial merge, since the
 * edit dialog always resends the whole form).
 */
import { z } from "zod";

const rtpField = z.number().min(0.5).max(1).nullable().optional();
const gameField = z.string().max(120).nullable().optional();

export const qualifyingWagerFields = z.object({
  componentType: z.literal("qualifying_wager"),
  amount: z.number().positive(),
  rtp: rtpField,
});

export const cashFields = z.object({
  componentType: z.literal("cash"),
  amount: z.number().positive(),
});

export const bonusFields = z.object({
  componentType: z.literal("bonus"),
  amount: z.number().positive(),
  wageringMultiplier: z.number().min(0).max(200),
  rtp: rtpField,
  contributionPct: z.number().min(0.01).max(1).nullable().optional(),
  game: gameField,
});

export const freeSpinsFields = z.object({
  componentType: z.literal("free_spins"),
  spins: z.number().positive(),
  spinValue: z.number().positive(),
  rtp: rtpField,
  /** Winnings wagering x - 0/undefined = no secondary wagering stage */
  wageringMultiplier: z.number().min(0).max(200).nullable().optional(),
  contributionPct: z.number().min(0.01).max(1).nullable().optional(),
  game: gameField,
});

export const goldenChipsFields = z.object({
  componentType: z.literal("golden_chips"),
  chipCount: z.number().positive(),
  chipValue: z.number().positive(),
  /** Edge-derived RTP - required, no heuristic default for a fixed-edge game */
  rtp: z.number().min(0.5).max(1),
  houseEdgePreset: z.enum(["european", "american", "custom"]).nullable().optional(),
});

export const cashbackFields = z.object({
  componentType: z.literal("cashback"),
  /** Expected turnover over the qualifying period */
  amount: z.number().positive(),
  rtp: rtpField,
  cashbackPct: z.number().gt(0).max(1),
  cashbackCap: z.number().positive().nullable().optional(),
});

export const componentFieldsSchema = z.discriminatedUnion("componentType", [
  qualifyingWagerFields,
  cashFields,
  bonusFields,
  freeSpinsFields,
  goldenChipsFields,
  cashbackFields,
]);

export type ComponentFieldsInput = z.infer<typeof componentFieldsSchema>;

/** Normalised DB column values for a parsed component - null for every field the type doesn't use. */
export interface ComponentRowValues {
  componentType: ComponentFieldsInput["componentType"];
  amount: number | null;
  wageringMultiplier: number | null;
  rtp: number | null;
  contributionPct: number | null;
  spins: number | null;
  spinValue: number | null;
  chipCount: number | null;
  chipValue: number | null;
  houseEdgePreset: "european" | "american" | "custom" | null;
  cashbackPct: number | null;
  cashbackCap: number | null;
  game: string | null;
}

const EMPTY_ROW: Omit<ComponentRowValues, "componentType"> = {
  amount: null,
  wageringMultiplier: null,
  rtp: null,
  contributionPct: null,
  spins: null,
  spinValue: null,
  chipCount: null,
  chipValue: null,
  houseEdgePreset: null,
  cashbackPct: null,
  cashbackCap: null,
  game: null,
};

/** Maps a parsed component (any branch) to explicit, fully-nulled DB column values. */
export function toComponentRowValues(input: ComponentFieldsInput): ComponentRowValues {
  switch (input.componentType) {
    case "qualifying_wager":
      return { ...EMPTY_ROW, componentType: input.componentType, amount: input.amount, rtp: input.rtp ?? null };
    case "cash":
      return { ...EMPTY_ROW, componentType: input.componentType, amount: input.amount };
    case "bonus":
      return {
        ...EMPTY_ROW,
        componentType: input.componentType,
        amount: input.amount,
        wageringMultiplier: input.wageringMultiplier,
        rtp: input.rtp ?? null,
        contributionPct: input.contributionPct ?? null,
        game: input.game ?? null,
      };
    case "free_spins":
      return {
        ...EMPTY_ROW,
        componentType: input.componentType,
        spins: input.spins,
        spinValue: input.spinValue,
        rtp: input.rtp ?? null,
        wageringMultiplier: input.wageringMultiplier ?? null,
        contributionPct: input.contributionPct ?? null,
        game: input.game ?? null,
      };
    case "golden_chips":
      return {
        ...EMPTY_ROW,
        componentType: input.componentType,
        chipCount: input.chipCount,
        chipValue: input.chipValue,
        rtp: input.rtp,
        houseEdgePreset: input.houseEdgePreset ?? null,
      };
    case "cashback":
      return {
        ...EMPTY_ROW,
        componentType: input.componentType,
        amount: input.amount,
        rtp: input.rtp ?? null,
        cashbackPct: input.cashbackPct,
        cashbackCap: input.cashbackCap ?? null,
      };
  }
}
