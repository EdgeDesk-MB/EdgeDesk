import { describe, expect, it } from "vitest";
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { publicDemoPlansHref } from "@/lib/demo/public-demo";
import { canDesk } from "./effective-plan";
import {
  EDGE_DESK_PROMOS,
  featureForDeskPath,
  planLockCopy,
  planLockEmptyCopy,
  planLockPlansHref,
} from "./nav";

const freeDesk = {
  billing: { plan: "free" as const, billingStatus: "none" as const },
  planPreview: "unlocked" as const,
};

describe("featureForDeskPath", () => {
  it("maps specified Core and Edge surfaces, and leaves the rest open", () => {
    expect(featureForDeskPath("/offers")).toBe("offers_pipeline");
    expect(featureForDeskPath("/offers/calendar")).toBe("offers_pipeline");
    expect(featureForDeskPath("/tracker")).toBe("calculators");
    expect(featureForDeskPath("/acca")).toBe("acca_desk");
    expect(featureForDeskPath("/bet-builder")).toBe("bet_builder_desk");
    expect(featureForDeskPath("/systems")).toBe("systems_desk");
    expect(featureForDeskPath("/report")).toBe("do_next");
    expect(featureForDeskPath("/desk")).toBeNull();
    expect(featureForDeskPath("/calculators")).toBeNull();
    expect(featureForDeskPath("/calculators/ep-desk")).toBeNull();
    expect(featureForDeskPath("/racing")).toBeNull();
    expect(featureForDeskPath("/accounts")).toBeNull();
    expect(featureForDeskPath("/casino")).toBeNull();
  });

  it("lets a Free account open Profit Tracker and still locks offers", () => {
    const tracker = featureForDeskPath("/tracker");
    const offers = featureForDeskPath("/offers");
    expect(tracker).toBe("calculators");
    expect(offers).toBe("offers_pipeline");
    expect(canDesk(freeDesk, tracker!)).toBe(true);
    expect(canDesk(freeDesk, offers!)).toBe(false);
  });
});

describe("planLockCopy", () => {
  it("names Core for pipeline desks and Edge for Offer Edge", () => {
    expect(planLockCopy("offers_pipeline").title).toBe(
      "Available on Core subscription"
    );
    expect(planLockCopy("acca_desk").title).toBe("Available on Core subscription");
    expect(planLockCopy("offer_edge").title).toBe("Available on Edge subscription");
    expect(planLockCopy("offers_pipeline").description).toContain("Core and Edge");
    expect(planLockCopy("offers_pipeline").description).toContain(
      "Offers pipeline and free-bet lots"
    );
    expect(planLockCopy("offers_pipeline").description).not.toMatch(/tracker/i);
  });
});

describe("planLockEmptyCopy", () => {
  it("invites upgrade on the page, not via toast wording", () => {
    const offers = planLockEmptyCopy("offers_pipeline", { real: true });
    expect(offers.title).toBe("Available on Core subscription");
    expect(offers.description).toBe(
      "Track bookie offers as campaigns. Qualifiers through to free bet payouts.\nIncluded on Core and Edge."
    );
    expect(offers.action).toEqual({
      label: "View plans",
      href: SETTINGS_SUBSCRIPTION_HREF,
    });
    expect(offers.secondaryAction.href).toBe("/tracker");
    expect(offers.description).not.toMatch(/Upgrade in Settings/);

    expect(planLockEmptyCopy("do_next").title).toBe(
      "Available on Core subscription"
    );

    const picks = planLockEmptyCopy("offer_edge", { publicDemo: true });
    expect(picks.title).toBe("Available on Edge subscription");
    expect(picks.action.href).toBe(publicDemoPlansHref());
    expect(picks.secondaryAction.href).toBe("/calculators");

    const racing = planLockEmptyCopy("racing_live_feeds");
    expect(racing.description).toBe(
      "Today's UK and Irish racecards and results. Demo cards are shown on Racing Desk."
    );
    expect(racing.description).not.toMatch(/set/i);
  });

  it("sends public demo View plans to the marketing table", () => {
    expect(planLockPlansHref({ publicDemo: true })).toBe(publicDemoPlansHref());
    expect(planLockPlansHref()).toBe(SETTINGS_SUBSCRIPTION_HREF);
  });

  it("keeps desk promos as a title-and-body pair for bundled Edge flags", () => {
    expect(EDGE_DESK_PROMOS.racing.title).toBe("Available on Edge subscription");
    expect(EDGE_DESK_PROMOS.racing.description).toMatch(/Offer Edge picks/);
    expect(EDGE_DESK_PROMOS.racing.description).toBe(
      "Today's UK and Irish cards, Offer Edge picks, and live exchange lays."
    );
    expect(EDGE_DESK_PROMOS.racing.description).not.toMatch(/Demo cards below/);
    expect(EDGE_DESK_PROMOS.twoUp.title).toBe("Available on Edge subscription");
    expect(EDGE_DESK_PROMOS.twoUp.description).toBe(
      "Get notified when a 2UP position needs a decision. Live exchange prices on this desk are Edge too."
    );
  });
});
