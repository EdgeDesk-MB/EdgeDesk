import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureServerEvent } = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
}));
vi.mock("@/lib/analytics/server-capture", () => ({ captureServerEvent }));

import {
  captureUpgradeStarted,
  upgradeStartedProperties,
} from "@/lib/analytics/upgrade-started";

describe("upgrade_started", () => {
  beforeEach(() => captureServerEvent.mockClear());

  it("sends the plan key only", () => {
    expect(upgradeStartedProperties("edge")).toEqual({ plan: "edge" });
    expect(upgradeStartedProperties("core")).toEqual({ plan: "core" });
  });

  it("captures once against the Clerk id", () => {
    captureUpgradeStarted({ clerkUserId: "user_abc", plan: "core" });
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    expect(captureServerEvent).toHaveBeenCalledWith("user_abc", "upgrade_started", {
      plan: "core",
    });
  });
});
