import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, appUsers } from "@/lib/db";
import { applyStripeSubscription } from "@/lib/billing/handle-stripe-event";
import {
  applyAppUserEntitlement,
  ensureAppUser,
  findAppUserByClerkId,
  findAppUserByStripeCustomerId,
  normaliseAppUserEmail,
  recordAppUserLegalAcceptance,
  saveAppUserOnboardingProfile,
} from "@/lib/services/app-users";

describe("normaliseAppUserEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseAppUserEmail("  Sam@Edgeways.app ")).toBe(
      "sam@edgeways.app"
    );
    expect(normaliseAppUserEmail("")).toBeNull();
    expect(normaliseAppUserEmail(null)).toBeNull();
  });
});

describe("ensureAppUser", () => {
  it("inserts a Clerk-keyed row and refreshes email on the same id", async () => {
    const clerkUserId = `user_test_${Date.now()}`;

    const created = await ensureAppUser({
      clerkUserId,
      email: "First@Example.com",
    });
    expect(created.clerkUserId).toBe(clerkUserId);
    expect(created.email).toBe("first@example.com");

    const stored = db
      .select()
      .from(appUsers)
      .where(eq(appUsers.clerkUserId, clerkUserId))
      .get();
    expect(stored?.email).toBe("first@example.com");
    expect(stored?.createdAt).toBe(created.createdAt);

    const updated = await ensureAppUser({
      clerkUserId,
      email: "Second@Example.com",
    });
    expect(updated.email).toBe("second@example.com");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    const found = await findAppUserByClerkId(clerkUserId);
    expect(found?.email).toBe("second@example.com");
    expect(found?.createdAt).toBe(created.createdAt);
  });

  it("keeps an existing email when the later sync has none", async () => {
    const clerkUserId = `user_test_keep_${Date.now()}`;
    await ensureAppUser({ clerkUserId, email: "keep@example.com" });
    const again = await ensureAppUser({ clerkUserId, email: null });
    expect(again.email).toBe("keep@example.com");
  });
});

describe("recordAppUserLegalAcceptance (EDGE-105)", () => {
  it("stamps the server time and document version, first write wins", async () => {
    const clerkUserId = `user_test_legal_${Date.now()}`;
    await ensureAppUser({ clerkUserId, email: "legal@example.com" });

    const before = Date.now();
    await recordAppUserLegalAcceptance({
      clerkUserId,
      legalVersion: "26 August 2026",
    });
    const first = await findAppUserByClerkId(clerkUserId);
    expect(first?.legalAcceptedAt).toBeGreaterThanOrEqual(before);
    expect(first?.legalVersion).toBe("26 August 2026");

    // A second record attempt must not move the audit timestamp.
    const stamped = first!.legalAcceptedAt!;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await recordAppUserLegalAcceptance({
      clerkUserId,
      legalVersion: "1 January 2099",
    });
    const second = await findAppUserByClerkId(clerkUserId);
    expect(second?.legalAcceptedAt).toBe(stamped);
    expect(second?.legalVersion).toBe("26 August 2026");
  });

  it("is a no-op for a blank user id", async () => {
    await expect(
      recordAppUserLegalAcceptance({
        clerkUserId: "  ",
        legalVersion: "26 August 2026",
      })
    ).resolves.toBeUndefined();
  });
});

describe("applyAppUserEntitlement", () => {
  it("writes trial Edge onto the Clerk row", async () => {
    const clerkUserId = `user_test_ent_${Date.now()}`;
    await ensureAppUser({ clerkUserId, email: "pay@example.com" });
    const row = await applyAppUserEntitlement({
      clerkUserId,
      entitlement: {
        plan: "edge",
        billingStatus: "trialing",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        trialEndsAt: 1_800_000_000_000,
        cancelAt: null,
        founding: false,
      },
    });
    expect(row.plan).toBe("edge");
    expect(row.billingStatus).toBe("trialing");
    expect(row.stripeCustomerId).toBe("cus_test");
    expect(row.trialEndsAt).toBe(1_800_000_000_000);
    expect(row.cancelAt).toBeNull();
    expect(row.founding).toBe(false);
    expect(row.onboardingProfile).toBeNull();
    const byCustomer = await findAppUserByStripeCustomerId("cus_test");
    expect(byCustomer?.clerkUserId).toBe(clerkUserId);
  });

  it("applies a Stripe subscription object via Clerk metadata", async () => {
    const clerkUserId = `user_test_sub_${Date.now()}`;
    await applyStripeSubscription({
      id: "sub_meta",
      status: "trialing",
      customer: "cus_meta",
      trial_end: 1_800_000_000,
      metadata: { clerkUserId, plan: "edge" },
      items: { data: [{ price: { id: "price_not_in_env" } }] },
    } as never);
    const row = await findAppUserByClerkId(clerkUserId);
    expect(row?.plan).toBe("edge");
    expect(row?.billingStatus).toBe("trialing");
    expect(row?.stripeCustomerId).toBe("cus_meta");
  });
});

describe("saveAppUserOnboardingProfile", () => {
  it("stores the first-run answers on the Clerk row", async () => {
    const clerkUserId = `user_test_onboard_${Date.now()}`;
    await ensureAppUser({ clerkUserId, email: "onboard@example.com" });
    const row = await saveAppUserOnboardingProfile({
      clerkUserId,
      profile: {
        experience: "spreadsheet",
        whyHere: ["calculators"],
        whyHereOther: null,
        attribution: "discord",
        attributionOther: null,
        savedAt: 1_700_000_000_000,
      },
    });
    expect(row.onboardingProfile?.experience).toBe("spreadsheet");
    expect(row.onboardingProfile?.attribution).toBe("discord");
  });
});
