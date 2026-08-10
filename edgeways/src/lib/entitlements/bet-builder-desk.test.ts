import { describe, expect, it } from "vitest";
import { canUseBetBuilderDesk } from "./bet-builder-desk";

describe("canUseBetBuilderDesk", () => {
  it("mirrors Acca Desk entitlement", () => {
    expect(canUseBetBuilderDesk()).toBe(true);
    expect(canUseBetBuilderDesk({ planPreview: "unlocked" })).toBe(true);
    expect(canUseBetBuilderDesk({ planPreview: "core" })).toBe(true);
    expect(canUseBetBuilderDesk({ planPreview: "edge" })).toBe(true);
    expect(canUseBetBuilderDesk({ planPreview: "free" })).toBe(false);
  });
});
