/**
 * EDGE-67: pure decision for whether a referee's first paid invoice grants
 * the referrer a credit. Kept Stripe-free so the abuse rules are unit-tested;
 * the webhook handler gathers the facts and applies the verdict.
 */

export type ReferralCreditBlock =
  | "already_credited"
  | "no_referrer"
  | "self_referral"
  | "same_customer"
  | "same_card";

export type ReferralCreditVerdict =
  | { grant: true }
  | { grant: false; reason: ReferralCreditBlock };

export function referralCreditVerdict(input: {
  /** Referee already triggered a credit (one credit per referee). */
  alreadyCredited: boolean;
  referrerClerkUserId: string | null;
  refereeClerkUserId: string;
  referrerStripeCustomerId: string | null;
  refereeStripeCustomerId: string | null;
  /** Card fingerprints when both could be read from Stripe; null = unknown. */
  refereeCardFingerprint: string | null;
  referrerCardFingerprints: string[];
}): ReferralCreditVerdict {
  if (input.alreadyCredited) return { grant: false, reason: "already_credited" };
  if (!input.referrerClerkUserId) return { grant: false, reason: "no_referrer" };
  if (input.referrerClerkUserId === input.refereeClerkUserId) {
    return { grant: false, reason: "self_referral" };
  }
  if (
    input.referrerStripeCustomerId &&
    input.refereeStripeCustomerId &&
    input.referrerStripeCustomerId === input.refereeStripeCustomerId
  ) {
    return { grant: false, reason: "same_customer" };
  }
  if (
    input.refereeCardFingerprint &&
    input.referrerCardFingerprints.includes(input.refereeCardFingerprint)
  ) {
    return { grant: false, reason: "same_card" };
  }
  return { grant: true };
}

/** £10 flat account credit, tier-agnostic (negative = balance credit). */
export const REFERRAL_CREDIT_AMOUNT_PENCE = -1000;
export const REFERRAL_CREDIT_CURRENCY = "gbp";
