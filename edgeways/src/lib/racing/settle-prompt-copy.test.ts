import { describe, expect, it } from "vitest";
import { settlePromptCopy } from "@/lib/racing/settle-prompt-copy";

describe("settlePromptCopy", () => {
  it("sends the user to Tracked Events from other pages", () => {
    expect(
      settlePromptCopy({ placement: "elsewhere", pendingCount: 1 })
    ).toEqual({
      lead: "none",
      actionKind: "link-tracked-events",
      racePhrase: "this race",
    });
  });

  it("points at Set result on the page when already on Tracked Events", () => {
    expect(
      settlePromptCopy({ placement: "tracked-events", pendingCount: 1 })
    ).toEqual({
      lead: "none",
      actionKind: "set-result-on-page",
      racePhrase: "this race",
    });
  });

  it("uses these races when more than one is waiting", () => {
    expect(
      settlePromptCopy({
        placement: "tracked-events",
        pendingCount: 3,
      }).racePhrase
    ).toBe("these races");
  });

  it("keeps the auto-sync lead when results are available", () => {
    expect(
      settlePromptCopy({
        placement: "tracked-events",
        resultsTier: "basic",
        pendingCount: 1,
      }).lead
    ).toBe("auto-sync");
  });
});
