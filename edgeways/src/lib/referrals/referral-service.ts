/**
 * EDGE-67 referral service. Codes live on app_users; each code is mirrored to
 * a Stripe Promotion Code on the referral coupon so Checkout can redeem it.
 * The referee's first paid invoice grants the referrer a customer-balance
 * credit (see handle-stripe-event.ts → invoice.paid).
 */
import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe-server";
import {
  claimAppUserReferral,
  ensureAppUser,
  findAppUserByClerkId,
  findAppUserByReferralCode,
  findAppUserByStripeCustomerId,
  markAppUserReferralCredited,
  saveAppUserReferralCode,
  type AppUser,
} from "@/lib/services/app-users";
import {
  generateReferralCode,
  isReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referrals/code";
import {
  REFERRAL_CREDIT_AMOUNT_PENCE,
  REFERRAL_CREDIT_CURRENCY,
  referralCreditVerdict,
  type ReferralCreditBlock,
} from "@/lib/referrals/credit-decision";
import { captureServerEvent } from "@/lib/analytics/server-capture";

export function referralCouponId(): string | null {
  return process.env.STRIPE_REFERRAL_COUPON_ID?.trim() || null;
}

/**
 * Get or lazily create the user's code. When Stripe and the coupon are
 * configured, also ensure the matching Promotion Code exists so the code
 * works in Checkout. Stripe failures never block the code itself.
 */
export async function ensureReferralCodeForUser(
  clerkUserId: string
): Promise<{ code: string; promotionCodeLive: boolean }> {
  const user = await ensureAppUser({ clerkUserId });
  if (user.referralCode && isReferralCodeFormat(user.referralCode)) {
    const promotionCodeLive = await ensureStripePromotionCode(user.referralCode);
    return { code: user.referralCode, promotionCodeLive };
  }
  // Codes minted before the anonymity change (name prefix) are rotated.

  // Suffix collisions are possible; retry with a fresh code a few times.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateReferralCode();
    const taken = await findAppUserByReferralCode(code);
    if (taken) continue;
    await saveAppUserReferralCode({ clerkUserId, referralCode: code });
    const promotionCodeLive = await ensureStripePromotionCode(code);
    return { code, promotionCodeLive };
  }
  throw new Error("Could not allocate a unique referral code.");
}

async function ensureStripePromotionCode(code: string): Promise<boolean> {
  const coupon = referralCouponId();
  if (!coupon || !process.env.STRIPE_SECRET_KEY?.trim()) return false;
  try {
    const stripe = getStripe();
    const existing = await stripe.promotionCodes.list({ code, limit: 1 });
    if (existing.data.length > 0) return true;
    await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon },
      code,
      metadata: { purpose: "edge-67-referrals" },
    });
    return true;
  } catch (error) {
    console.error("[referrals] promotion code ensure failed", error);
    return false;
  }
}

export type ReferralClaimResult =
  | { status: "claimed"; referrerCode: string }
  | { status: "already_referred" }
  | { status: "invalid" }
  | { status: "self" }
  | { status: "unknown_code" };

/**
 * Best-effort claim from a landing route (?ref=CODE). Never throws; captures
 * referral_redeemed on a fresh claim.
 */
export async function claimReferralBestEffort(
  clerkUserId: string,
  rawCode: string | null | undefined
): Promise<void> {
  if (!rawCode?.trim()) return;
  try {
    const result = await claimReferral({ clerkUserId, code: rawCode });
    if (result.status === "claimed") {
      captureServerEvent(clerkUserId, "referral_redeemed", {
        referral_code: result.referrerCode,
        surface: "link",
      });
    }
  } catch (error) {
    console.error("[referrals] claim failed", error);
  }
}

export async function claimReferral(input: {
  clerkUserId: string;
  code: string;
}): Promise<ReferralClaimResult> {
  const code = normalizeReferralCode(input.code);
  if (!isReferralCodeFormat(code)) return { status: "invalid" };
  const referrer = await findAppUserByReferralCode(code);
  if (!referrer) return { status: "unknown_code" };
  if (referrer.clerkUserId === input.clerkUserId) return { status: "self" };
  // /subscribe can run before /api/account/sync. Without a row, the UPDATE
  // in claimAppUserReferral matches nothing and the share link is lost.
  await ensureAppUser({ clerkUserId: input.clerkUserId });
  const claimed = await claimAppUserReferral({
    clerkUserId: input.clerkUserId,
    referrerClerkUserId: referrer.clerkUserId,
  });
  if (!claimed) return { status: "already_referred" };
  return { status: "claimed", referrerCode: code };
}

/** Card fingerprints seen on a customer's recent charges (abuse check). */
async function cardFingerprintsForCustomer(
  stripe: Stripe,
  customerId: string
): Promise<string[]> {
  try {
    const charges = await stripe.charges.list({ customer: customerId, limit: 20 });
    const fingerprints = new Set<string>();
    for (const charge of charges.data) {
      const card = charge.payment_method_details?.card;
      if (card?.fingerprint) fingerprints.add(card.fingerprint);
    }
    return [...fingerprints];
  } catch (error) {
    console.error("[referrals] fingerprint lookup failed", error);
    return [];
  }
}

/** Promotion code applied to an invoice, across Stripe API shapes. */
function invoicePromotionCode(invoice: Stripe.Invoice): string | null {
  const discounts = (
    invoice as Stripe.Invoice & {
      discounts?: Array<{ promotion_code?: string | { id: string } | null }>;
      discount?: { promotion_code?: string | { id: string } | null } | null;
    }
  ).discounts;
  const legacy = (
    invoice as Stripe.Invoice & {
      discount?: { promotion_code?: string | { id: string } | null } | null;
    }
  ).discount;
  const all = [...(discounts ?? []), ...(legacy ? [legacy] : [])];
  for (const discount of all) {
    const promo = discount.promotion_code;
    if (typeof promo === "string" && promo) return promo;
    if (promo && typeof promo === "object" && promo.id) return promo.id;
  }
  return null;
}

async function referrerForInvoice(referee: AppUser): Promise<AppUser | null> {
  if (referee.referredBy) {
    const referrer = await findAppUserByClerkId(referee.referredBy);
    if (referrer) return referrer;
  }
  return null;
}

export type ReferralInvoiceOutcome =
  | { granted: true; referrerClerkUserId: string; creditPence: number }
  | { granted: false; reason: ReferralCreditBlock | "not_applicable" };

/**
 * invoice.paid handler: the referee's first non-zero paid invoice grants the
 * referrer a £10 balance credit. Idempotent via referral_credit_at.
 */
export async function grantReferralCreditForInvoice(
  invoice: Stripe.Invoice
): Promise<ReferralInvoiceOutcome> {
  if (invoice.amount_paid <= 0) return { granted: false, reason: "not_applicable" };
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return { granted: false, reason: "not_applicable" };

  const referee = await findAppUserByStripeCustomerId(customerId);
  if (!referee) return { granted: false, reason: "not_applicable" };

  const stripe = getStripe();

  // Promo code on the invoice wins over referred_by: it proves redemption.
  let referrer: AppUser | null = null;
  const promoId = invoicePromotionCode(invoice);
  if (promoId) {
    try {
      const promo = await stripe.promotionCodes.retrieve(promoId);
      if (promo.code) {
        referrer = (await findAppUserByReferralCode(promo.code)) ?? null;
      }
    } catch (error) {
      console.error("[referrals] promotion code lookup failed", error);
    }
  }
  referrer = referrer ?? (await referrerForInvoice(referee));

  const refereeFingerprints = await cardFingerprintsForCustomer(stripe, customerId);
  const referrerFingerprints = referrer?.stripeCustomerId
    ? await cardFingerprintsForCustomer(stripe, referrer.stripeCustomerId)
    : [];

  const verdict = referralCreditVerdict({
    alreadyCredited: referee.referralCreditAt != null,
    referrerClerkUserId: referrer?.clerkUserId ?? null,
    refereeClerkUserId: referee.clerkUserId,
    referrerStripeCustomerId: referrer?.stripeCustomerId ?? null,
    refereeStripeCustomerId: customerId,
    refereeCardFingerprint: refereeFingerprints[0] ?? null,
    referrerCardFingerprints: referrerFingerprints,
  });
  if (!verdict.grant) return { granted: false, reason: verdict.reason };
  if (!referrer?.stripeCustomerId) return { granted: false, reason: "no_referrer" };

  await stripe.customers.createBalanceTransaction(referrer.stripeCustomerId, {
    amount: REFERRAL_CREDIT_AMOUNT_PENCE,
    currency: REFERRAL_CREDIT_CURRENCY,
    description: "Referral reward — a friend joined Edgeways with your code.",
    metadata: {
      purpose: "edge-67-referral-credit",
      refereeClerkUserId: referee.clerkUserId,
      invoiceId: invoice.id,
    },
  });
  await markAppUserReferralCredited({
    clerkUserId: referee.clerkUserId,
    creditedAt: Date.now(),
  });
  captureServerEvent(referrer.clerkUserId, "referral_credited", {
    credit_pence: -REFERRAL_CREDIT_AMOUNT_PENCE,
    referee_clerk_user_id: referee.clerkUserId,
  });
  return {
    granted: true,
    referrerClerkUserId: referrer.clerkUserId,
    creditPence: -REFERRAL_CREDIT_AMOUNT_PENCE,
  };
}
