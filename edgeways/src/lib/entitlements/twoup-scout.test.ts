import { describe, expect, it } from "vitest";
import { canUseTwoupScout } from "./twoup-scout";

const edge = { plan: "edge" as const, billingStatus: "active" as const };
const core = { plan: "core" as const, billingStatus: "active" as const };

describe("canUseTwoupScout", () => {
  it("stays closed until the server injects the preview latch", () => {
    expect(canUseTwoupScout({ billing: edge })).toBe(false);
    expect(canUseTwoupScout({ billing: edge, twoupScoutPreview: false })).toBe(
      false
    );
    expect(canUseTwoupScout(null)).toBe(false);
  });

  it("still needs Edge once the preview is on", () => {
    expect(
      canUseTwoupScout({ billing: edge, twoupScoutPreview: true })
    ).toBe(true);
    expect(
      canUseTwoupScout({ billing: core, twoupScoutPreview: true })
    ).toBe(false);
  });
});
