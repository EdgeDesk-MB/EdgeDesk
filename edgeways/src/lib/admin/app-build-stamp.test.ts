import { describe, expect, it } from "vitest";
import { APP_VERSION } from "@/lib/app-version";
import { getAppBuildStamp } from "./app-build-stamp";

describe("getAppBuildStamp", () => {
  it("prefers the Vercel deployment id", () => {
    expect(
      getAppBuildStamp({
        VERCEL_DEPLOYMENT_ID: "dpl_123",
        VERCEL_GIT_COMMIT_SHA: "abcdef",
      })
    ).toBe("dpl_123");
  });

  it("falls back to the commit sha, then the display version", () => {
    expect(getAppBuildStamp({ VERCEL_GIT_COMMIT_SHA: "abcdef" })).toBe("abcdef");
    expect(getAppBuildStamp({})).toBe(`version:${APP_VERSION}`);
  });
});
