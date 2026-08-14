import { describe, expect, it } from "vitest";
import {
  freeBetExpiringAlertKeys,
  offerExpiringAlertKeys,
} from "@/lib/alerts/expiring-alert-keys";
import {
  freeBetExpiringDismissTags,
  offerExpiringDismissTags,
  quietFreeBetAlerts,
  quietOfferAlerts,
} from "./quiet-alerts";

describe("quiet-alerts exports", () => {
  it("exposes offer and free-bet quieting", () => {
    expect(typeof quietOfferAlerts).toBe("function");
    expect(typeof quietFreeBetAlerts).toBe("function");
  });
});

describe("offerExpiringDismissTags", () => {
  it("covers today and yesterday action-kind keys", () => {
    const now = Date.parse("2026-08-03T12:00:00Z");
    const tags = offerExpiringDismissTags(5, now);
    const today = offerExpiringAlertKeys(5, now);
    const yesterday = offerExpiringAlertKeys(5, now - 24 * 60 * 60 * 1000);
    for (const key of today) expect(tags).toContain(key);
    for (const key of yesterday) expect(tags).toContain(key);
    expect(tags.length).toBe(new Set(tags).size);
  });
});

describe("freeBetExpiringDismissTags", () => {
  it("covers today and yesterday lot keys", () => {
    const now = Date.parse("2026-08-03T12:00:00Z");
    const tags = freeBetExpiringDismissTags(12, now);
    const today = freeBetExpiringAlertKeys(12, now);
    const yesterday = freeBetExpiringAlertKeys(12, now - 24 * 60 * 60 * 1000);
    for (const key of today) expect(tags).toContain(key);
    for (const key of yesterday) expect(tags).toContain(key);
    expect(tags.length).toBe(new Set(tags).size);
  });
});
