import { describe, expect, it } from "vitest";
import {
  clerkIdsForPreviewWarm,
  evaluateDeskPreview,
  normalizeDeskPreviews,
  parseDeskPreviews,
} from "./desk-previews-shared";

describe("normalizeDeskPreviews", () => {
  it("fails closed on junk", () => {
    expect(normalizeDeskPreviews(null).twoup_scout.mode).toBe("off");
    expect(normalizeDeskPreviews({ twoup_scout: { mode: "nope" } }).twoup_scout).toEqual({
      mode: "off",
      clerkUserIds: [],
    });
  });

  it("keeps a valid allowlist and drops blanks", () => {
    const next = normalizeDeskPreviews({
      twoup_scout: { mode: "allowlist", clerkUserIds: [" user_a ", "", "user_a"] },
      offer_inbox: { mode: "entitled", clerkUserIds: ["user_b"] },
    });
    expect(next.twoup_scout).toEqual({
      mode: "allowlist",
      clerkUserIds: ["user_a"],
    });
    expect(next.offer_inbox.mode).toBe("entitled");
  });
});

describe("parseDeskPreviews", () => {
  it("returns off for empty or invalid JSON", () => {
    expect(parseDeskPreviews(null).offer_inbox.mode).toBe("off");
    expect(parseDeskPreviews("not-json").twoup_scout.mode).toBe("off");
  });
});

describe("evaluateDeskPreview", () => {
  it("is always on for the local desk", () => {
    expect(
      evaluateDeskPreview({
        hosted: false,
        mode: "off",
        clerkUserIds: [],
        clerkUserId: null,
      })
    ).toBe(true);
  });

  it("fails closed on hosted without a user or when off", () => {
    expect(
      evaluateDeskPreview({
        hosted: true,
        mode: "allowlist",
        clerkUserIds: ["user_a"],
        clerkUserId: null,
      })
    ).toBe(false);
    expect(
      evaluateDeskPreview({
        hosted: true,
        mode: "off",
        clerkUserIds: ["user_a"],
        clerkUserId: "user_a",
      })
    ).toBe(false);
  });

  it("honours allowlist and entitled", () => {
    expect(
      evaluateDeskPreview({
        hosted: true,
        mode: "allowlist",
        clerkUserIds: ["user_a"],
        clerkUserId: "user_a",
      })
    ).toBe(true);
    expect(
      evaluateDeskPreview({
        hosted: true,
        mode: "allowlist",
        clerkUserIds: ["user_a"],
        clerkUserId: "user_b",
      })
    ).toBe(false);
    expect(
      evaluateDeskPreview({
        hosted: true,
        mode: "entitled",
        clerkUserIds: [],
        clerkUserId: "user_b",
      })
    ).toBe(true);
  });
});

describe("clerkIdsForPreviewWarm", () => {
  it("picks none, allowlist, or entitled ids", () => {
    expect(
      clerkIdsForPreviewWarm({
        mode: "off",
        allowlist: ["a"],
        entitledClerkUserIds: ["b"],
      })
    ).toEqual([]);
    expect(
      clerkIdsForPreviewWarm({
        mode: "allowlist",
        allowlist: ["a"],
        entitledClerkUserIds: ["b"],
      })
    ).toEqual(["a"]);
    expect(
      clerkIdsForPreviewWarm({
        mode: "entitled",
        allowlist: ["a"],
        entitledClerkUserIds: ["b", "c"],
      })
    ).toEqual(["b", "c"]);
  });
});
