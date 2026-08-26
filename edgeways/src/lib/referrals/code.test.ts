import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  isReferralCodeFormat,
  normalizeReferralCode,
  referralShareUrl,
} from "@/lib/referrals/code";

describe("normalizeReferralCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeReferralCode("  k7q2-9xtm ")).toBe("K7Q2-9XTM");
    expect(normalizeReferralCode("k7q2 9xtm")).toBe("K7Q29XTM");
  });

  it("handles nullish input", () => {
    expect(normalizeReferralCode(null)).toBe("");
    expect(normalizeReferralCode(undefined)).toBe("");
  });
});

describe("isReferralCodeFormat", () => {
  it("accepts XXXX-XXXX codes", () => {
    expect(isReferralCodeFormat("K7Q2-9XTM")).toBe(true);
    expect(isReferralCodeFormat("ABCD-2345")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(isReferralCodeFormat("")).toBe(false);
    expect(isReferralCodeFormat("K7Q2")).toBe(false);
    expect(isReferralCodeFormat("K7Q-9XTM")).toBe(false);
    expect(isReferralCodeFormat("K7Q2-9XT")).toBe(false);
    expect(isReferralCodeFormat("K7Q2-9XTMM")).toBe(false);
    expect(isReferralCodeFormat("k7q2-9xtm")).toBe(false);
    // 0/1 are excluded from the alphabet (read-aloud ambiguity).
    expect(isReferralCodeFormat("K7Q2-9XT0")).toBe(false);
    expect(isReferralCodeFormat("K7Q2-9XT1")).toBe(false);
  });

  it("carries no identity — no name-shaped codes", () => {
    expect(isReferralCodeFormat("SAM-A4F2")).toBe(false);
  });
});

describe("generateReferralCode", () => {
  it("produces valid codes from a seeded random", () => {
    const code = generateReferralCode(() => 0.5);
    expect(isReferralCodeFormat(code)).toBe(true);
  });

  it("never emits ambiguous characters", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const code = generateReferralCode(() => r);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("clamps an out-of-range random value", () => {
    const code = generateReferralCode(() => 1);
    expect(isReferralCodeFormat(code)).toBe(true);
  });

  it("varies across calls", () => {
    const values = [0.1, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6];
    let i = 0;
    const a = generateReferralCode(() => values[i++ % values.length]);
    i = 0;
    const b = generateReferralCode(() => values[values.length - 1 - (i++ % values.length)]);
    expect(a).not.toBe(b);
  });
});

describe("referralShareUrl", () => {
  it("builds the sign-up link with the code", () => {
    expect(referralShareUrl("K7Q2-9XTM")).toBe(
      "https://edgeways.app/sign-up?ref=K7Q2-9XTM"
    );
  });
});
