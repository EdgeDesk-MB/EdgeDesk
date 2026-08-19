import { describe, expect, it } from "vitest";
import {
  parseStoredPlanId,
  resolveSetupDisplayPlan,
  setupUpgradeSuccessPlan,
} from "@/lib/onboarding-setup-upgrade";

describe("setup upgrade signal", () => {
  it("accepts only real plan ids", () => {
    expect(parseStoredPlanId("edge")).toBe("edge");
    expect(parseStoredPlanId("core")).toBe("core");
    expect(parseStoredPlanId("free")).toBe("free");
    expect(parseStoredPlanId("pro")).toBeNull();
  });

  it("uses the receipt plan before billing catches up", () => {
    expect(resolveSetupDisplayPlan("free", "edge")).toBe("edge");
    expect(resolveSetupDisplayPlan("edge", "core")).toBe("edge");
    expect(resolveSetupDisplayPlan(null, "core")).toBe("core");
    expect(resolveSetupDisplayPlan("free", null)).toBe("free");
  });

  it("celebrates a checkout confirmation even when baseline is already the new plan", () => {
    expect(
      setupUpgradeSuccessPlan({
        currentPlan: "edge",
        baseline: "edge",
        confirmed: "edge",
        intent: "edge",
      })
    ).toBe("edge");
  });

  it("celebrates when they clicked upgrade and billing now matches", () => {
    expect(
      setupUpgradeSuccessPlan({
        currentPlan: "core",
        baseline: "core",
        confirmed: null,
        intent: "core",
      })
    ).toBe("core");
  });

  it("stays quiet when they never started checkout", () => {
    expect(
      setupUpgradeSuccessPlan({
        currentPlan: "edge",
        baseline: "edge",
        confirmed: null,
        intent: null,
      })
    ).toBeNull();
  });

  it("stays quiet when they opened checkout but are still on Free", () => {
    expect(
      setupUpgradeSuccessPlan({
        currentPlan: "free",
        baseline: "free",
        confirmed: null,
        intent: "edge",
      })
    ).toBeNull();
  });

  it("falls back to a remembered lower baseline", () => {
    expect(
      setupUpgradeSuccessPlan({
        currentPlan: "edge",
        baseline: "free",
        confirmed: null,
        intent: null,
      })
    ).toBe("edge");
  });
});
