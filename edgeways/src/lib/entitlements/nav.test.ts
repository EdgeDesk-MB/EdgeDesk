import { describe, expect, it } from "vitest";
import { canDesk } from "./effective-plan";
import { featureForDeskPath, planLockCopy } from "./nav";

const freeDesk = {
  billing: { plan: "free" as const, billingStatus: "none" as const },
  planPreview: "unlocked" as const,
};

describe("featureForDeskPath", () => {
  it("maps specified Core and Edge surfaces, and leaves the rest open", () => {
    expect(featureForDeskPath("/offers")).toBe("offers_pipeline");
    expect(featureForDeskPath("/offers/calendar")).toBe("offers_pipeline");
    expect(featureForDeskPath("/tracker")).toBe("calculators");
    expect(featureForDeskPath("/acca")).toBe("acca_desk");
    expect(featureForDeskPath("/bet-builder")).toBe("bet_builder_desk");
    expect(featureForDeskPath("/systems")).toBe("systems_desk");
    expect(featureForDeskPath("/report")).toBe("do_next");
    expect(featureForDeskPath("/desk")).toBeNull();
    expect(featureForDeskPath("/calculators")).toBeNull();
    expect(featureForDeskPath("/calculators/ep-desk")).toBeNull();
    expect(featureForDeskPath("/racing")).toBeNull();
    expect(featureForDeskPath("/accounts")).toBeNull();
    expect(featureForDeskPath("/casino")).toBeNull();
  });

  it("lets a Free account open Profit Tracker and still locks offers", () => {
    const tracker = featureForDeskPath("/tracker");
    const offers = featureForDeskPath("/offers");
    expect(tracker).toBe("calculators");
    expect(offers).toBe("offers_pipeline");
    expect(canDesk(freeDesk, tracker!)).toBe(true);
    expect(canDesk(freeDesk, offers!)).toBe(false);
  });
});

describe("planLockCopy", () => {
  it("names Core for pipeline desks and Edge for Offer Edge", () => {
    expect(planLockCopy("offers_pipeline").title).toBe("Core plan");
    expect(planLockCopy("acca_desk").title).toBe("Core plan");
    expect(planLockCopy("offer_edge").title).toBe("Edge plan");
    expect(planLockCopy("offers_pipeline").description).toContain("Core and Edge");
    expect(planLockCopy("offers_pipeline").description).toContain(
      "Offers pipeline and free-bet lots"
    );
    expect(planLockCopy("offers_pipeline").description).not.toMatch(/tracker/i);
  });
});
