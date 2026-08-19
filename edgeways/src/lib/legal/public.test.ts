import { describe, expect, it } from "vitest";
import {
  ICO_REGISTRATION_NOTE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NAV,
  LEGAL_OPERATOR,
  LEGAL_PATHS,
} from "@/lib/legal/public";

describe("public legal surface", () => {
  it("keeps customer paths stable", () => {
    expect(LEGAL_PATHS.terms).toBe("/terms");
    expect(LEGAL_PATHS.privacy).toBe("/privacy");
    expect(LEGAL_NAV.map((item) => item.label)).toEqual([
      "Terms",
      "Privacy",
      "Contact",
      "Refunds",
    ]);
  });

  it("names the sole trader and a dated policy", () => {
    expect(LEGAL_OPERATOR).toMatch(/Sam Hayter/);
    expect(LEGAL_EFFECTIVE_DATE).toMatch(/2026/);
    expect(ICO_REGISTRATION_NOTE.toLowerCase()).toContain("not yet required");
  });
});
