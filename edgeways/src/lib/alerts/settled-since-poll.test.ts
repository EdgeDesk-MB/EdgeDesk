import { describe, expect, it } from "vitest";
import {
  SETTLEMENT_ANNOUNCE_MAX_AGE_MS,
  isRecentSettlement,
  mergeSettledStatusMap,
  resultSettledAlertKey,
  resultSettledAlertKeys,
  settledBetIdsToAnnounce,
} from "./settled-since-poll";

const NOW = 1_800_000_000_000;

function snap(
  id: number,
  status: string,
  settledAt: number | null = NOW - 1_000
): { id: number; status: string; settledAt: number | null } {
  return { id, status, settledAt };
}

describe("settled-since-poll", () => {
  it("builds result_settled keys", () => {
    expect(resultSettledAlertKey(20)).toBe("result_settled:20");
    expect(resultSettledAlertKeys([20, 21])).toEqual([
      "result_settled:20",
      "result_settled:21",
    ]);
  });

  it("treats the first poll as a silent seed", () => {
    expect(
      settledBetIdsToAnnounce(null, [snap(20, "lost"), snap(21, "won")], NOW)
    ).toEqual([]);
  });

  it("announces a bet that settled after the seed", () => {
    const previous = new Map([[20, "lost"]]);
    expect(
      settledBetIdsToAnnounce(previous, [snap(20, "lost"), snap(21, "won")], NOW)
    ).toEqual([21]);
  });

  it("skips history that reappears after a thin poll", () => {
    const previous = mergeSettledStatusMap(new Map([[20, "lost"]]), [], []);
    expect(previous.get(20)).toBe("lost");
    expect(
      settledBetIdsToAnnounce(
        previous,
        [snap(20, "lost", NOW - 40 * 24 * 60 * 60_000), snap(21, "lost", NOW - 1_000)],
        NOW
      )
    ).toEqual([21]);
  });

  it("does not announce a first-seen settle older than the age window", () => {
    const previous = new Map<number, string>();
    expect(
      settledBetIdsToAnnounce(
        previous,
        [snap(20, "lost", NOW - SETTLEMENT_ANNOUNCE_MAX_AGE_MS - 1)],
        NOW
      )
    ).toEqual([]);
    expect(
      settledBetIdsToAnnounce(
        previous,
        [snap(20, "lost", NOW - SETTLEMENT_ANNOUNCE_MAX_AGE_MS)],
        NOW
      )
    ).toEqual([20]);
  });

  it("still announces a void/push revision of a known settle", () => {
    const previous = new Map([[20, "lost"]]);
    expect(
      settledBetIdsToAnnounce(
        previous,
        [snap(20, "void", NOW - 40 * 24 * 60 * 60_000)],
        NOW
      )
    ).toEqual([20]);
  });

  it("does not announce a first-seen void or push", () => {
    const previous = new Map<number, string>();
    expect(
      settledBetIdsToAnnounce(previous, [snap(20, "void"), snap(21, "push")], NOW)
    ).toEqual([]);
  });

  it("drops an id only when this poll shows the bet is open again", () => {
    const seeded = mergeSettledStatusMap(null, [snap(20, "lost"), snap(21, "won")]);
    const afterThin = mergeSettledStatusMap(seeded, [], []);
    expect([...afterThin.keys()].sort((a, b) => a - b)).toEqual([20, 21]);
    const afterUnsettle = mergeSettledStatusMap(afterThin, [snap(21, "won")], [20]);
    expect(afterUnsettle.has(20)).toBe(false);
    expect(afterUnsettle.get(21)).toBe("won");
  });

  it("rejects a missing settledAt as not recent", () => {
    expect(isRecentSettlement(null, NOW)).toBe(false);
  });
});
