/**
 * Detect "money back as a free bet if the bet loses" (Refund-If) offers.
 * Distinct from place-refund ("money back if 2nd or 3rd") and from
 * unconditional bet&get ("Bet £X get £Y" regardless of result).
 */

export const REFUND_IF_QUALIFY_DETAIL =
  "Underlay on the exchange with the Refund-If calculator so both outcomes include the free-bet value.";

export const REFUND_IF_AWAIT_TITLE = "Await the result";

export const REFUND_IF_AWAIT_DETAIL =
  "If it wins, the underlay already locked the profit. If it loses, convert the free bet next.";

const PLACE_FINISH =
  /\b(?:2nd|3rd|4th|5th|6th|finishes?|placed|in\s+the\s+frame)\b/i;

/** Lose-conditional money-back / risk-free wording (not place-refund). */
export function isRefundIfText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const loseConditional =
    /\bmoney\s+back(?:\s+as\s+a\s+free\s*bet)?\s+if\s+(?:your\s+)?(?:horse|bet|selection|first\s+bet)?\s*los/i.test(
      trimmed
    ) ||
    /\bmoney\s+back\s+as\s+a\s+free\s*bet[\s\S]{0,120}?\bif\s+(?:your\s+)?(?:horse|bet|selection)\s+los/i.test(
      trimmed
    ) ||
    /\brefund(?:ed)?\s+as\s+(?:a\s+)?free\s*bet\s+if\s+[\s\S]{0,40}?\blos/i.test(trimmed) ||
    /\bif\s+your\s+(?:horse|bet|selection)\s+los/i.test(trimmed) ||
    /\bonly\s+occur\s+if\s+your\s+bet\s+los/i.test(trimmed) ||
    /\bstake\s+(?:back|refunded)\s+if\s+[\s\S]{0,24}?\blos/i.test(trimmed) ||
    /\brisk[- ]?free(?:\s+bet)?\b/i.test(trimmed) ||
    (/\bsecond\s+chance\b/i.test(trimmed) &&
      /\b(?:los|money\s+back|free\s*bet)\b/i.test(trimmed));

  if (!loseConditional) return false;
  // "Money back if 2nd or 3rd" is a place refund, not lose-conditional.
  if (PLACE_FINISH.test(trimmed) && !/\blos/i.test(trimmed)) return false;
  return true;
}

function rulesFlagRefundIf(rules: string | null | undefined): boolean {
  if (!rules) return false;
  try {
    const parsed = JSON.parse(rules) as {
      refundIf?: unknown;
      playbook?: { refundIf?: unknown };
      importantNotes?: unknown;
    };
    if (parsed.refundIf === true) return true;
    if (parsed.playbook?.refundIf === true) return true;
    if (typeof parsed.importantNotes === "string" && isRefundIfText(parsed.importantNotes)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** True when a stored campaign is a Refund-If / money-back-if-loses offer. */
export function isRefundIfOffer(offer: {
  title?: string | null;
  description?: string | null;
  rules?: string | null;
}): boolean {
  if (isRefundIfText(offer.title ?? "")) return true;
  if (isRefundIfText(offer.description ?? "")) return true;
  return rulesFlagRefundIf(offer.rules);
}
