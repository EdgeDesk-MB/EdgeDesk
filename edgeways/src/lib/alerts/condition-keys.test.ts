import { describe, expect, it } from "vitest";
import { clearedConditionAlertKeys, isConditionAlertKey } from "./condition-keys";

describe("isConditionAlertKey", () => {
  it("matches live prompt kinds only", () => {
    expect(isConditionAlertKey("offer_expiring:offer-5-place_qualifying:2026-08-03")).toBe(true);
    expect(isConditionAlertKey("naked_exposure:97")).toBe(true);
    expect(isConditionAlertKey("race_off_soon:evt-1")).toBe(true);
    expect(isConditionAlertKey("two_up_lock:12")).toBe(true);
    expect(isConditionAlertKey("result_settled:12")).toBe(false);
    expect(isConditionAlertKey("test:1")).toBe(false);
  });
});

describe("clearedConditionAlertKeys", () => {
  it("returns previously active condition keys that are no longer firing", () => {
    const prev = [
      "offer_expiring:offer-5-place_qualifying:2026-08-03",
      "naked_exposure:97",
      "result_settled:1",
    ];
    const active = new Set(["naked_exposure:97"]);
    expect(clearedConditionAlertKeys(prev, active)).toEqual([
      "offer_expiring:offer-5-place_qualifying:2026-08-03",
    ]);
  });

  it("ignores keys that remain active", () => {
    const key = "offer_expiring:offer-5-place_qualifying:2026-08-03";
    expect(clearedConditionAlertKeys([key], new Set([key]))).toEqual([]);
  });
});
