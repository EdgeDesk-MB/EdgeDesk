import { describe, expect, it } from "vitest";
import {
  parseStoredPlanId,
  resolveSetupDisplayPlan,
  setupUpgradeSuccess,
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
      setupUpgradeSuccess({
        currentPlan: "edge",
        baseline: "edge",
        confirmed: "edge",
        intent: "edge",
      })
    ).toEqual({ plan: "edge", inFlow: true });
  });

  it("celebrates when they clicked upgrade and billing rose to match", () => {
    expect(
      setupUpgradeSuccess({
        currentPlan: "core",
        baseline: "free",
        confirmed: null,
        intent: "core",
      })
    ).toEqual({ plan: "core", inFlow: true });
  });

  it("stays quiet when intent matches a plan they already had", () => {
    expect(
      setupUpgradeSuccess({
        currentPlan: "core",
        baseline: "core",
        confirmed: null,
        intent: "core",
      })
    ).toBeNull();
  });

  it("stays quiet when they never started checkout", () => {
    expect(
      setupUpgradeSuccess({
        currentPlan: "edge",
        baseline: "edge",
        confirmed: null,
        intent: null,
      })
    ).toBeNull();
  });

  it("stays quiet when they opened checkout but are still on Free", () => {
    expect(
      setupUpgradeSuccess({
        currentPlan: "free",
        baseline: "free",
        confirmed: null,
        intent: "edge",
      })
    ).toBeNull();
  });

  it("marks a remembered lower baseline without intent as arrived-subscribed, not in-flow", () => {
    expect(
      setupUpgradeSuccess({
        currentPlan: "edge",
        baseline: "free",
        confirmed: null,
        intent: null,
      })
    ).toEqual({ plan: "edge", inFlow: false });
  });
});
