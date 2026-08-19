import { describe, expect, it } from "vitest";
import { featureForDeskPath, planLockCopy } from "./nav";

describe("featureForDeskPath", () => {
  it("maps specified Core and Edge surfaces, and leaves the rest open", () => {
    expect(featureForDeskPath("/offers")).toBe("offers_pipeline");
    expect(featureForDeskPath("/offers/calendar")).toBe("offers_pipeline");
    expect(featureForDeskPath("/tracker")).toBe("offers_pipeline");
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
});

describe("planLockCopy", () => {
  it("names Core for pipeline desks and Edge for Offer Edge", () => {
    expect(planLockCopy("offers_pipeline").title).toBe("Core plan");
    expect(planLockCopy("acca_desk").title).toBe("Core plan");
    expect(planLockCopy("offer_edge").title).toBe("Edge plan");
    expect(planLockCopy("offers_pipeline").description).toContain("Core and Edge");
  });
});
