import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureServerEvent, stripe } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
  stripe: {
    customers: { list: vi.fn(), update: vi.fn() },
    subscriptions: { list: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock("@/lib/analytics/server-capture", () => ({ captureServerEvent }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_upgrade_journey" }),
  currentUser: async () => ({
    primaryEmailAddress: { emailAddress: "upgrade@example.com" },
    emailAddresses: [],
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/billing/stripe-server", () => ({
  getStripe: () => stripe,
  stripePortalConfigurationId: () => null,
}));
vi.mock("@/lib/billing/stripe-prices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/stripe-prices")>()),
  publicCatalogueReady: () => true,
  publicStripePriceId: () => "price_test",
}));
vi.mock("@/lib/billing/founding-schedule", () => ({
  foundingCheckoutPriceId: () => null,
}));
vi.mock("@/lib/services/waitlist", () => ({
  isWaitlistFoundingEligible: async () => false,
}));
vi.mock("@/lib/referrals/referral-service", () => ({
  claimReferralBestEffort: async () => {},
  referralCouponId: () => null,
}));

import { GET } from "@/app/subscribe/route";

function subscribe() {
  return GET(new Request("http://localhost/subscribe?plan=core&interval=month"));
}

describe("upgrade_started on /subscribe", () => {
  beforeEach(() => {
    captureServerEvent.mockClear();
    stripe.customers.list.mockResolvedValue({ data: [] });
    stripe.subscriptions.list.mockResolvedValue({ data: [] });
    stripe.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.test/session",
    });
    stripe.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.test/portal",
    });
  });

  it("fires once with the plan key when Checkout starts", async () => {
    const res = await subscribe();
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/session");
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    expect(captureServerEvent).toHaveBeenCalledWith(
      "user_upgrade_journey",
      "upgrade_started",
      { plan: "core" }
    );
    expect(JSON.stringify(captureServerEvent.mock.calls)).not.toMatch(/@|price_/);
  });

  it("stays silent when Stripe returns no checkout URL", async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ url: null });
    const res = await subscribe();
    expect(res.status).toBe(502);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("stays silent for a live subscriber sent to the portal", async () => {
    stripe.customers.list.mockResolvedValue({
      data: [{ id: "cus_live", metadata: { clerkUserId: "user_upgrade_journey" } }],
    });
    stripe.subscriptions.list.mockResolvedValue({ data: [{ status: "active" }] });
    const res = await subscribe();
    expect(res.headers.get("location")).toBe("https://billing.stripe.test/portal");
    expect(captureServerEvent).not.toHaveBeenCalled();
  });
});
