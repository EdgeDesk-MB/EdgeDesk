import { describe, expect, it } from "vitest";
import { deskPagePrefetchPaths } from "./prefetch-desk-pages";

describe("deskPagePrefetchPaths", () => {
  const now = Date.parse("2026-09-11T12:00:00+01:00");

  it("warms today and tomorrow for Fixtures", () => {
    expect(deskPagePrefetchPaths("/fixtures", now)).toEqual([
      "/api/fixtures?date=2026-09-11",
      "/api/fixtures?date=2026-09-12",
      "/api/racing/racecards?date=2026-09-11",
      "/api/racing/racecards?date=2026-09-12",
    ]);
  });

  it("warms Racing Desk for today", () => {
    expect(deskPagePrefetchPaths("/racing", now)).toEqual([
      "/api/racing/desk?date=2026-09-11",
      "/api/racing/racecards?date=2026-09-11",
      "/api/racing/racecards?date=2026-09-12",
    ]);
  });

  it("warms History and Alerts lists", () => {
    expect(deskPagePrefetchPaths("/history")).toEqual([
      "/api/history?filter=all&limit=200",
    ]);
    expect(deskPagePrefetchPaths("/alerts")).toEqual(["/api/alerts"]);
  });

  it("skips pages that already live in /api/state", () => {
    expect(deskPagePrefetchPaths("/desk")).toEqual([]);
    expect(deskPagePrefetchPaths("/tracker")).toEqual([]);
  });
});
