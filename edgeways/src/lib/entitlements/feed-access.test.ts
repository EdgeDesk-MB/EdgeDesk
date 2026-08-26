import { describe, expect, it } from "vitest";
import { shouldDenyFeed } from "./feed-access";

const core = { plan: "core", billingStatus: "active" } as const;
const edge = { plan: "edge", billingStatus: "active" } as const;
const trial = { plan: "edge", billingStatus: "trialing" } as const;
const canceled = { plan: "edge", billingStatus: "canceled" } as const;

describe("shouldDenyFeed", () => {
  it("fails open without a billing row", () => {
    expect(shouldDenyFeed(null, "racing_live_feeds")).toBe(false);
    expect(shouldDenyFeed(undefined, "exchange_lay")).toBe(false);
    expect(shouldDenyFeed(null, "offer_edge")).toBe(false);
  });

  it("denies Core and Free on Edge-only feeds", () => {
    expect(shouldDenyFeed(core, "racing_live_feeds")).toBe(true);
    expect(shouldDenyFeed(core, "exchange_lay")).toBe(true);
    expect(shouldDenyFeed(core, "offer_edge")).toBe(true);
    expect(
      shouldDenyFeed({ plan: "free", billingStatus: "none" }, "racing_live_feeds")
    ).toBe(true);
  });

  it("allows a live Edge row", () => {
    expect(shouldDenyFeed(edge, "racing_live_feeds")).toBe(false);
    expect(shouldDenyFeed(edge, "exchange_lay")).toBe(false);
    expect(shouldDenyFeed(trial, "offer_edge")).toBe(false);
  });

  it("denies a lapsed Edge row", () => {
    expect(shouldDenyFeed(canceled, "racing_live_feeds")).toBe(true);
    expect(shouldDenyFeed(canceled, "exchange_lay")).toBe(true);
  });

  it("does not lock Core off Core desks", () => {
    expect(shouldDenyFeed(core, "acca_desk")).toBe(false);
    expect(shouldDenyFeed(core, "offers_pipeline")).toBe(false);
  });
});
