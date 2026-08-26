import { describe, expect, it } from "vitest";
import { parseLockedFeedBody } from "./api-feed-lock";

describe("parseLockedFeedBody", () => {
  it("returns the payload on a locked 403", () => {
    expect(
      parseLockedFeedBody(403, JSON.stringify({ source: "locked", plays: [] }))
    ).toEqual({ source: "locked", plays: [] });
  });

  it("ignores other statuses and unstructured 403s", () => {
    expect(parseLockedFeedBody(200, JSON.stringify({ source: "locked" }))).toBeNull();
    expect(parseLockedFeedBody(403, JSON.stringify({ error: "Forbidden" }))).toBeNull();
    expect(parseLockedFeedBody(403, "not-json")).toBeNull();
  });
});
