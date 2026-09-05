import { describe, expect, it } from "vitest";
import {
  adjacentSnapValue,
  clampScrollLeft,
  easeOutCubic,
  nearestValue,
  panTranslateX,
  pickSnapTarget,
  pointerVelocityPxPerMs,
  projectScrollLeft,
  rubberScrollLeft,
  settleDurationMs,
  snapScrollFromContentOffset,
  visualScrollFromDx,
} from "./drag-scroll";

describe("easeOutCubic", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
});

describe("pointerVelocityPxPerMs", () => {
  it("is zero without a pair of samples", () => {
    expect(pointerVelocityPxPerMs([])).toBe(0);
    expect(pointerVelocityPxPerMs([{ t: 10, x: 4 }])).toBe(0);
  });

  it("reads pointer-right as positive so the row follows the cursor", () => {
    expect(
      pointerVelocityPxPerMs([
        { t: 0, x: 100 },
        { t: 50, x: 150 },
      ])
    ).toBe(1);
  });

  it("ignores samples older than the flick window", () => {
    expect(
      pointerVelocityPxPerMs([
        { t: 0, x: 0 },
        { t: 200, x: 400 },
        { t: 240, x: 420 },
      ])
    ).toBe(0.5);
  });
});

describe("projectScrollLeft", () => {
  it("decreases scrollLeft when the pointer flicks right", () => {
    expect(projectScrollLeft(400, 1, 800, 200)).toBe(200);
  });

  it("clamps to the scroll range", () => {
    expect(projectScrollLeft(20, 1, 800, 200)).toBe(0);
    expect(projectScrollLeft(780, -1, 800, 200)).toBe(800);
  });
});

describe("pickSnapTarget", () => {
  const snaps = [0, 312, 624, 936];

  it("snaps to the nearest card on a gentle release", () => {
    expect(pickSnapTarget(snaps, 40, 0, 0.05)).toBe(0);
    expect(pickSnapTarget(snaps, 200, 0, 0.1)).toBe(312);
  });

  it("follows the projected coast on a flick", () => {
    expect(pickSnapTarget(snaps, 40, 700, 0.8)).toBe(624);
  });
});

describe("rubber / compositor pan", () => {
  it("follows the pointer 1:1 in range", () => {
    expect(visualScrollFromDx(100, 40, 800)).toBe(60);
    expect(panTranslateX(100, 60)).toBe(40);
  });

  it("rubber-bands past 0 and max instead of clamping hard", () => {
    expect(rubberScrollLeft(-100, 800)).toBeCloseTo(-32);
    expect(rubberScrollLeft(900, 800)).toBeCloseTo(832);
    expect(visualScrollFromDx(0, 50, 800)).toBeCloseTo(-16);
  });

  it("builds snap targets from content offsets, not transformed boxes", () => {
    expect(snapScrollFromContentOffset(24, 24, 900)).toBe(0);
    expect(snapScrollFromContentOffset(336, 24, 900)).toBe(312);
  });
});

describe("nearestValue / clamp / duration", () => {
  it("picks the closest candidate", () => {
    expect(nearestValue([0, 100, 200], 130)).toBe(100);
  });

  it("steps to the adjacent snap", () => {
    expect(adjacentSnapValue([0, 312, 624], 0, 1)).toBe(312);
    expect(adjacentSnapValue([0, 312, 624], 312, -1)).toBe(0);
    expect(adjacentSnapValue([0, 312, 624], 200, 1)).toBe(624);
    expect(adjacentSnapValue([0, 312], 0, -1)).toBeNull();
    expect(adjacentSnapValue([0, 312], 312, 1)).toBeNull();
  });

  it("clamps scroll into range", () => {
    expect(clampScrollLeft(-4, 50)).toBe(0);
    expect(clampScrollLeft(80, 50)).toBe(50);
    expect(clampScrollLeft(20, 0)).toBe(0);
  });

  it("keeps settle time in the 200–480ms band", () => {
    expect(settleDurationMs(10, 5)).toBe(200);
    expect(settleDurationMs(2000, 0.2)).toBe(480);
    expect(settleDurationMs(120, 0.4)).toBe(300);
  });
});
