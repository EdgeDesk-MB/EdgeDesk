import { describe, expect, it } from "vitest";
import {
  parseStoredReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  referralCookieOptions,
  resolveReferralCode,
  stampReferralCookie,
} from "@/lib/referrals/persist";

describe("parseStoredReferralCode", () => {
  it("accepts a well-formed code and normalises case", () => {
    expect(parseStoredReferralCode("  k7q2-9xtm ")).toBe("K7Q2-9XTM");
  });

  it("rejects junk so a bad URL cannot overwrite a real cookie", () => {
    expect(parseStoredReferralCode("not-a-code")).toBeNull();
    expect(parseStoredReferralCode("")).toBeNull();
    expect(parseStoredReferralCode(null)).toBeNull();
  });
});

describe("resolveReferralCode", () => {
  it("prefers a valid query over the cookie", () => {
    expect(resolveReferralCode("ABCD-2345", "K7Q2-9XTM")).toBe("ABCD-2345");
  });

  it("falls back to the cookie when the URL has no code", () => {
    expect(resolveReferralCode(null, "K7Q2-9XTM")).toBe("K7Q2-9XTM");
    expect(resolveReferralCode("nope", "K7Q2-9XTM")).toBe("K7Q2-9XTM");
  });

  it("returns null when neither source is a code", () => {
    expect(resolveReferralCode("nope", "still-nope")).toBeNull();
  });
});

describe("stampReferralCookie", () => {
  it("writes a 30-day first-party cookie for a valid ?ref=", () => {
    const writes: Array<{ name: string; value: string; options: unknown }> = [];
    const code = stampReferralCookie("k7q2-9xtm", {
      set(name, value, options) {
        writes.push({ name, value, options });
      },
    });
    expect(code).toBe("K7Q2-9XTM");
    expect(writes).toEqual([
      {
        name: REFERRAL_COOKIE,
        value: "K7Q2-9XTM",
        options: referralCookieOptions(),
      },
    ]);
    expect(REFERRAL_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("does not touch cookies for an invalid ?ref=", () => {
    const writes: unknown[] = [];
    expect(
      stampReferralCookie("garbage", {
        set(...args) {
          writes.push(args);
        },
      })
    ).toBeNull();
    expect(writes).toEqual([]);
  });
});
