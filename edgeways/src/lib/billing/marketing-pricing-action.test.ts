import { describe, expect, it } from "vitest";
import { marketingPricingAction } from "@/lib/billing/marketing-pricing-action";

describe("marketingPricingAction", () => {
  it("holds CTAs until Clerk has loaded", () => {
    expect(
      marketingPricingAction({
        authLoaded: false,
        signedIn: false,
        billingLoaded: false,
        liveSubscriber: false,
      })
    ).toBe("pending");
  });

  it("shows plan checkout as soon as the visitor is signed out", () => {
    expect(
      marketingPricingAction({
        authLoaded: true,
        signedIn: false,
        billingLoaded: false,
        liveSubscriber: false,
      })
    ).toBe("checkout");
  });

  it("holds CTAs while a signed-in billing fetch is in flight", () => {
    expect(
      marketingPricingAction({
        authLoaded: true,
        signedIn: true,
        billingLoaded: false,
        liveSubscriber: false,
      })
    ).toBe("pending");
  });

  it("shows one manage action for a live subscriber", () => {
    expect(
      marketingPricingAction({
        authLoaded: true,
        signedIn: true,
        billingLoaded: true,
        liveSubscriber: true,
      })
    ).toBe("manage");
  });

  it("shows plan checkout for a signed-in Free account", () => {
    expect(
      marketingPricingAction({
        authLoaded: true,
        signedIn: true,
        billingLoaded: true,
        liveSubscriber: false,
      })
    ).toBe("checkout");
  });
});
