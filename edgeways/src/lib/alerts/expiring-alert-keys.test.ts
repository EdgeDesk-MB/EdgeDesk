import { describe, expect, it } from "vitest";
import {
  alertDayKey,
  freeBetExpiringAlertDedupePrefix,
  freeBetExpiringAlertKey,
  freeBetExpiringAlertKeys,
  offerExpiringAlertDedupePrefix,
  offerExpiringAlertKeys,
} from "./expiring-alert-keys";

const NOW = new Date(2026, 6, 13, 9, 0, 0).getTime();

describe("expiring-alert-keys", () => {
  it("uses the local calendar day", () => {
    expect(alertDayKey(NOW)).toBe("2026-07-13");
  });

  it("covers every actionable offer_expiring kind for today", () => {
    const keys = offerExpiringAlertKeys(5, NOW);
    expect(keys).toContain("offer_expiring:offer-5-place_qualifying:2026-07-13");
    expect(keys).toContain("offer_expiring:offer-5-convert_free_bet:2026-07-13");
    expect(offerExpiringAlertDedupePrefix(5)).toBe("offer_expiring:offer-5-");
  });

  it("names a free-bet lot with a prefix quiet-alerts can LIKE", () => {
    expect(freeBetExpiringAlertKey(12, NOW)).toBe(
      "free_bet_expiring:lot-12:2026-07-13"
    );
    expect(freeBetExpiringAlertKeys(12, NOW)).toEqual([
      "free_bet_expiring:lot-12:2026-07-13",
    ]);
    expect(freeBetExpiringAlertDedupePrefix(12)).toBe("free_bet_expiring:lot-12:");
  });
});
