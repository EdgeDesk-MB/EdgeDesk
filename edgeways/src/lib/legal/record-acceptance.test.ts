import { describe, expect, it } from "vitest";
import { clerkLegalAccepted } from "./record-acceptance";

describe("clerkLegalAccepted (EDGE-105)", () => {
  it("reads the sign-up consent flag from unsafeMetadata", () => {
    expect(
      clerkLegalAccepted({
        id: "user_1",
        unsafeMetadata: { legalAccepted: true, legalAcceptedAt: 123 },
      })
    ).toBe(true);
  });

  it("rejects missing, false and non-boolean flags", () => {
    expect(clerkLegalAccepted({ id: "user_1" })).toBe(false);
    expect(
      clerkLegalAccepted({ id: "user_1", unsafeMetadata: { legalAccepted: false } })
    ).toBe(false);
    expect(
      clerkLegalAccepted({
        id: "user_1",
        unsafeMetadata: { legalAccepted: "true" },
      })
    ).toBe(false);
    expect(clerkLegalAccepted(null)).toBe(false);
  });
});
