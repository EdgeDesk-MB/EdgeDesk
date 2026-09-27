import { describe, expect, it } from "vitest";
import {
  HIDDEN_RELOAD_IDLE_MS,
  USER_ACTIVITY_EVENTS,
  steppedAwayBeforeHiding,
  trackUserActivity,
} from "./user-activity";

const MIN = 60_000;

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("trackUserActivity", () => {
  it("counts idle time from when tracking began", () => {
    const c = clock();
    const tracker = trackUserActivity(new EventTarget(), c.now);
    expect(tracker.idleMs()).toBe(0);
    c.advance(3 * MIN);
    expect(tracker.idleMs()).toBe(3 * MIN);
    tracker.dispose();
  });

  it("resets on pointer, key, wheel, touch and scroll", () => {
    const c = clock();
    const target = new EventTarget();
    const tracker = trackUserActivity(target, c.now);
    for (const type of USER_ACTIVITY_EVENTS) {
      c.advance(20 * MIN);
      target.dispatchEvent(new Event(type));
      expect(tracker.idleMs(), type).toBe(0);
    }
    tracker.dispose();
  });

  it("ignores events that are not interaction", () => {
    const c = clock();
    const target = new EventTarget();
    const tracker = trackUserActivity(target, c.now);
    c.advance(11 * MIN);
    target.dispatchEvent(new Event("visibilitychange"));
    target.dispatchEvent(new Event("focus"));
    expect(tracker.idleMs()).toBe(11 * MIN);
    tracker.dispose();
  });

  it("markActive resets the idle clock", () => {
    const c = clock();
    const tracker = trackUserActivity(new EventTarget(), c.now);
    c.advance(15 * MIN);
    tracker.markActive();
    expect(tracker.idleMs()).toBe(0);
    tracker.dispose();
  });

  it("stops listening once disposed", () => {
    const c = clock();
    const target = new EventTarget();
    const tracker = trackUserActivity(target, c.now);
    tracker.dispose();
    c.advance(12 * MIN);
    target.dispatchEvent(new Event("pointerdown"));
    expect(tracker.idleMs()).toBe(12 * MIN);
  });
});

describe("steppedAwayBeforeHiding", () => {
  it("keeps a quick flip to a bookmaker tab mid-task", () => {
    expect(steppedAwayBeforeHiding(0)).toBe(false);
    expect(steppedAwayBeforeHiding(30_000)).toBe(false);
    expect(steppedAwayBeforeHiding(HIDDEN_RELOAD_IDLE_MS - 1)).toBe(false);
  });

  it("treats 10 idle minutes before hiding as stepped away", () => {
    expect(HIDDEN_RELOAD_IDLE_MS).toBe(10 * MIN);
    expect(steppedAwayBeforeHiding(HIDDEN_RELOAD_IDLE_MS)).toBe(true);
    expect(steppedAwayBeforeHiding(60 * MIN)).toBe(true);
  });
});
