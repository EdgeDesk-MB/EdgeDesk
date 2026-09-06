import { describe, expect, it } from "vitest";
import {
  crestLockupIconForEvent,
  crestLockupIconPath,
  footballPushBetId,
  isCrestLockupDate,
  isCrestLockupExternalId,
  isSafePushIconPath,
  parseCrestLockupSearch,
} from "./crest-lockup";

describe("crest lock-up path", () => {
  it("builds a public icon URL from fixture id + UK date", () => {
    expect(crestLockupIconPath({ externalId: "1379001", date: "2026-09-05" })).toBe(
      "/api/crest-lockup?id=1379001&d=2026-09-05"
    );
  });

  it("rejects invented ids and dates", () => {
    expect(crestLockupIconPath({ externalId: "1379001", date: "05/09/2026" })).toBeNull();
    expect(crestLockupIconPath({ externalId: "https://evil.test", date: "2026-09-05" })).toBeNull();
    expect(isCrestLockupDate("2026-09-05")).toBe(true);
    expect(isCrestLockupExternalId("team.1-2")).toBe(true);
    expect(isCrestLockupExternalId("a".repeat(65))).toBe(false);
  });

  it("parses the query the push payload uses", () => {
    const params = new URLSearchParams("id=1379001&d=2026-09-05");
    expect(parseCrestLockupSearch(params)).toEqual({
      externalId: "1379001",
      date: "2026-09-05",
    });
    expect(parseCrestLockupSearch(new URLSearchParams("id=&d=2026-09-05"))).toBeNull();
  });

  it("builds from a football event and skips racing", () => {
    expect(
      crestLockupIconForEvent({
        sport: "football",
        externalId: "1379001",
        startTime: Date.parse("2026-09-05T19:00:00+01:00"),
      })
    ).toBe("/api/crest-lockup?id=1379001&d=2026-09-05");
    expect(
      crestLockupIconForEvent({
        sport: "horse_racing",
        externalId: "1379001",
        startTime: Date.parse("2026-09-05T19:00:00+01:00"),
      })
    ).toBeNull();
  });

  it("only allows first-party icon paths on the push payload", () => {
    expect(isSafePushIconPath("/api/crest-lockup?id=1&d=2026-09-05")).toBe(true);
    expect(isSafePushIconPath("/icon-192.png?v=notif6")).toBe(true);
    expect(isSafePushIconPath("https://evil.test/x.png")).toBe(false);
  });
});

describe("footballPushBetId", () => {
  it("reads settlement and 2UP keys", () => {
    expect(footballPushBetId("result_settled:42")).toBe(42);
    expect(footballPushBetId("two_up_lock:7")).toBe(7);
    expect(footballPushBetId("offer_expiring:42")).toBeNull();
    expect(footballPushBetId("result_settled:nope")).toBeNull();
  });
});
