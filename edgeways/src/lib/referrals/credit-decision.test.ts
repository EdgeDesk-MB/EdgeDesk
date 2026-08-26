import { describe, expect, it } from "vitest";
import {
  REFERRAL_CREDIT_AMOUNT_PENCE,
  referralCreditVerdict,
} from "@/lib/referrals/credit-decision";

const BASE = {
  alreadyCredited: false,
  referrerClerkUserId: "user_referrer",
  refereeClerkUserId: "user_referee",
  referrerStripeCustomerId: "cus_referrer",
  refereeStripeCustomerId: "cus_referee",
  refereeCardFingerprint: "fp_referee",
  referrerCardFingerprints: ["fp_referrer"],
};

describe("referralCreditVerdict", () => {
  it("grants on a clean first paid invoice", () => {
    expect(referralCreditVerdict(BASE)).toEqual({ grant: true });
  });

  it("blocks when the referee already triggered a credit", () => {
    expect(referralCreditVerdict({ ...BASE, alreadyCredited: true })).toEqual({
      grant: false,
      reason: "already_credited",
    });
  });

  it("blocks when there is no referrer", () => {
    expect(
      referralCreditVerdict({ ...BASE, referrerClerkUserId: null })
    ).toEqual({ grant: false, reason: "no_referrer" });
  });

  it("blocks self-referral by Clerk id", () => {
    expect(
      referralCreditVerdict({
        ...BASE,
        referrerClerkUserId: "user_referee",
      })
    ).toEqual({ grant: false, reason: "self_referral" });
  });

  it("blocks when both sides share a Stripe customer", () => {
    expect(
      referralCreditVerdict({
        ...BASE,
        refereeStripeCustomerId: "cus_referrer",
      })
    ).toEqual({ grant: false, reason: "same_customer" });
  });

  it("blocks when the card fingerprint matches the referrer's", () => {
    expect(
      referralCreditVerdict({
        ...BASE,
        refereeCardFingerprint: "fp_referrer",
      })
    ).toEqual({ grant: false, reason: "same_card" });
  });

  it("grants when fingerprints are unknown (other checks still apply)", () => {
    expect(
      referralCreditVerdict({
        ...BASE,
        refereeCardFingerprint: null,
        referrerCardFingerprints: [],
      })
    ).toEqual({ grant: true });
  });
});

describe("REFERRAL_CREDIT_AMOUNT_PENCE", () => {
  it("is a negative £10 balance credit", () => {
    expect(REFERRAL_CREDIT_AMOUNT_PENCE).toBe(-1000);
  });
});
