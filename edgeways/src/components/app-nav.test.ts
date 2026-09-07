import { describe, expect, it } from "vitest";
import { isGroupLandingPath, isLinkActive } from "@/components/app-nav";

describe("isGroupLandingPath", () => {
  it("treats the first child as the parent landing, not sibling routes", () => {
    expect(isGroupLandingPath("/casino/calendar", "/casino/calendar")).toBe(true);
    expect(isGroupLandingPath("/casino/calendar?x=1", "/casino/calendar")).toBe(true);
    expect(isGroupLandingPath("/casino", "/casino/calendar")).toBe(false);
    expect(isGroupLandingPath("/desk", "/casino/calendar")).toBe(false);
  });
});

describe("isLinkActive", () => {
  it("does not mark Casino campaigns active on the calendar", () => {
    expect(isLinkActive("/casino/calendar", "/casino")).toBe(false);
    expect(isLinkActive("/casino", "/casino")).toBe(true);
    expect(isLinkActive("/casino/calendar", "/casino/calendar")).toBe(true);
  });
});
