import { describe, expect, it } from "vitest";
import {
  conditionAlertSubject,
  orphanConditionDedupes,
} from "./inbox-orphans";

describe("conditionAlertSubject", () => {
  it("maps lay-missing and 2UP keys to the bet", () => {
    expect(conditionAlertSubject("naked_exposure:40")).toEqual({
      table: "bets",
      id: 40,
    });
    expect(conditionAlertSubject("two_up_lock:80")).toEqual({
      table: "bets",
      id: 80,
    });
  });

  it("maps race-off and offer-expiring keys", () => {
    expect(conditionAlertSubject("race_off_soon:3")).toEqual({
      table: "events",
      id: 3,
    });
    expect(
      conditionAlertSubject("offer_expiring:offer-12-place_qualifying:2026-08-25")
    ).toEqual({ table: "offers", id: 12 });
  });

  it("ignores history keys and junk", () => {
    expect(conditionAlertSubject("result_settled:9")).toBeNull();
    expect(conditionAlertSubject("test:naked:2")).toBeNull();
    expect(conditionAlertSubject("naked_exposure:")).toBeNull();
    expect(conditionAlertSubject("")).toBeNull();
  });
});

describe("orphanConditionDedupes", () => {
  it("keeps keys whose desk row still exists", () => {
    expect(
      orphanConditionDedupes(["naked_exposure:40", "offer_expiring:offer-12-place_qualifying:2026-08-25"], {
        bets: new Set([40]),
        offers: new Set([12]),
        events: new Set(),
      })
    ).toEqual([]);
  });

  it("flags public-demo leftovers when the desk is empty", () => {
    expect(
      orphanConditionDedupes(
        [
          "naked_exposure:40",
          "naked_exposure:80",
          "result_settled:9",
        ],
        { bets: new Set(), offers: new Set(), events: new Set() }
      )
    ).toEqual(["naked_exposure:40", "naked_exposure:80"]);
  });
});
