import { describe, expect, it } from "vitest";
import { offerExpiringAlertKeys } from "@/lib/alerts/rules";
import { offerExpiringDismissTags } from "./quiet-alerts";

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
