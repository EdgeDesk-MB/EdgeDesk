import { describe, expect, it } from "vitest";
import { planGatePhase } from "./plan-route-gate";

const core = {
  billing: { plan: "core" as const, billingStatus: "active" as const },
  planPreview: "unlocked" as const,
};

const free = {
  billing: { plan: "free" as const, billingStatus: "none" as const },
  planPreview: "unlocked" as const,
};

describe("planGatePhase", () => {
  it("lets ungated paths through before state arrives", () => {
    expect(
      planGatePhase({
        pathname: "/desk",
        settings: null,
        hasState: false,
        error: null,
      })
    ).toBe("pass");
  });

  it("uses chrome settings so Offers is not stuck on Checking your plan", () => {
    expect(
      planGatePhase({
        pathname: "/offers/calendar",
        settings: core,
        hasState: false,
        error: null,
      })
    ).toBe("pass");
  });

  it("locks Offers from chrome when the plan is Free", () => {
    expect(
      planGatePhase({
        pathname: "/offers",
        settings: free,
        hasState: false,
        error: null,
      })
    ).toBe("lock");
  });

  it("waits when there is no chrome and no error", () => {
    expect(
      planGatePhase({
        pathname: "/offers",
        settings: null,
        hasState: false,
        error: null,
      })
    ).toBe("wait");
  });

  it("surfaces retry when the first /api/state fetch fails", () => {
    expect(
      planGatePhase({
        pathname: "/offers",
        settings: null,
        hasState: false,
        error: "HTTP 500",
      })
    ).toBe("error");
  });
});
