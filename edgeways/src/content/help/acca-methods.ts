/**
 * Shared Acca Desk method copy - create dialog, page help, guides, run cards.
 * Keep British English, commas not em dashes.
 */

import type { AccaRunRow } from "@/lib/db/schema";

export type AccaMethod = AccaRunRow["method"];

export interface AccaMethodHelp {
  label: string;
  /** One line under the Method select */
  blurb: string;
  /** When to pick this method */
  when: string;
  /** How the lays work, short steps */
  steps: string[];
  /** Shown on run-card method badge tooltip */
  badgeTooltip: string;
}

export const ACCA_METHOD_HELP: Record<AccaMethod, AccaMethodHelp> = {
  sequential: {
    label: "Sequential lock",
    blurb:
      "Lay each leg so a loss covers your stake plus liabilities already paid. The final leg equalises so the run ends the same either way.",
    when: "Use for ordinary cash qualifying accas when you want ~£0 if any leg loses, and a locked finish on the last leg.",
    steps: [
      "On the next leg (including right after you create the run), enter the live exchange lay odds and the suggested lay stake (editable), then log the lay. Alerts remind you from 30 minutes before the leg starts.",
      "Cover stake = (acca stake + liabilities already paid) ÷ (1 − commission). Lay odds do not change that stake, but you must enter the real price so the next leg sizes correctly.",
      "On the final pending leg, the stake switches to a lock-in: it uses your lay odds so win and lose finish at the same £.",
      "If any leg loses, the run stops. No further lays are needed.",
    ],
    badgeTooltip:
      "Sequential lock: cover each leg for ~£0 on a loss; final leg equalises both ways.",
  },
  insurance_legs: {
    label: "Insurance · lay leg-by-leg",
    blurb:
      "Same per-leg cover as sequential lock. Built for refund-if-one-loses offers: claim the free bet when exactly one leg loses.",
    when: "Use when the bookie refunds (free bet) if exactly one selection loses, and you prefer laying each leg rather than the whole acca.",
    steps: [
      "Lay each due leg the same way as sequential cover (live odds + suggested stake).",
      "Unlike sequential, the run stays open after a loss until every other leg has a result, so the desk can tell whether exactly one leg lost.",
      "When exactly one leg lost and you set a refund amount, the desk alerts you to claim the free bet.",
      "If two or more legs lose, there is usually no refund; cover still aimed to keep the cash side near £0 on each laid bust.",
    ],
    badgeTooltip:
      "Insurance leg-by-leg: cover lays like sequential; refund alert if exactly one leg loses.",
  },
  insurance_whole: {
    label: "Insurance · lay whole acca",
    blurb:
      "One equalising lay at the combined exchange price for the whole acca. Claim the refund free bet when exactly one leg loses.",
    when: "Use for refund-if-one-loses offers when a single combined market (or multi) is available on the exchange at a sensible price.",
    steps: [
      "Enter the live combined lay odds and the suggested lay stake, then log the whole-acca lay once.",
      "That lay equalises all-win vs any-lose on the cash side (same idea as a normal matched qualify).",
      "Record each leg result; the run completes when every leg is settled.",
      "When exactly one leg lost and you set a refund amount, the desk alerts you to claim the free bet.",
    ],
    badgeTooltip:
      "Insurance whole acca: one combined equalising lay; refund alert if exactly one leg loses.",
  },
  combined: {
    label: "Combined lay",
    blurb:
      "One equalising lay at the combined exchange price (Smarkets Multiples, Betfair pre-built, or Matchbook specials). No insurance refund.",
    when: "Use for ordinary cash or free-bet accas when you can sell the whole ticket as one lay. Choose No lay when liquidity is poor or you want to leave the back unmatched.",
    steps: [
      "Build the multiple on the exchange (buy each leg, then sell the multiple), or use a pre-built acca market.",
      "Enter the live combined lay odds and suggested stake, then log the lay once, or mark No lay.",
      "Record each leg result; the run completes when every leg is settled.",
    ],
    badgeTooltip: "Combined lay: one whole-acca equalising lay (or deliberate no lay).",
  },
};

/** Shared bullets for page help and the desk-how-tos guide. */
export const ACCA_DESK_HELP_BULLETS = [
  "Sequential lock: lay each leg to cover stake + liabilities paid so far (~£0 if that leg loses). The final leg equalises so win and lose finish at the same £.",
  "Insurance · leg-by-leg: same cover rhythm as sequential, for refund-if-one-loses offers. The run stays open after a loss until every leg resolves; claim the free bet when exactly one lost.",
  "Insurance · whole acca: one equalising lay at the combined exchange price, then settle legs. Same refund rule when exactly one leg loses.",
  "Combined lay: one Smarkets-style (or pre-built) equalising lay for the whole ticket, with optional No lay when matching is not worth it.",
  "The next unlaid leg shows Ready to lay as soon as earlier legs are done (or immediately for leg 1). Enter live exchange lay odds and stake, then Log lay or Fill slip. Set stake to £0.00 to Log no lay. Do not use the bookie back price.",
  "Alerts and Daily Plan still fire from 30 minutes before the leg starts (or immediately if there is no start time). You can lay earlier whenever you like.",
  "Legs linked to a tracked event auto-result from the football score or race result; anything else uses Won / Lost / Void on the desk.",
  "The acca back and every lay are real Profit Tracker bets. Free-bet converts still size cover like a cash stake at risk.",
  "When the next leg is laid (square), Worst outcome / Locked feeds platform provisional — matching cover ≈ £0 or the final-leg lock. Campaign P&L settles when the run finishes or busts. Mid-run lays stay off History.",
  "Sequential and insurance leg-by-leg warn if exchange cash cannot cover the next lay, or the larger reservation after earlier legs win. Combined and Systems do not grow a liability ladder.",
] as const;

/** Whole-ticket one-lay methods (insurance whole + combined). */
export function isWholeComboAccaMethod(
  method: AccaMethod
): method is "insurance_whole" | "combined" {
  return method === "insurance_whole" || method === "combined";
}
