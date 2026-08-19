import { describe, expect, it } from "vitest";
import {
  isLivelineLightOutline,
  isOpaqueCssColor,
  parseCssRgba,
} from "./liveline-tooltip-outline";

describe("parseCssRgba", () => {
  it("reads hex, legacy rgb, and modern rgb", () => {
    expect(parseCssRgba("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssRgba("rgba(255, 255, 255, 0.95)")).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 0.95,
    });
    expect(parseCssRgba("rgb(237 237 237 / 100%)")).toEqual({
      r: 237,
      g: 237,
      b: 237,
      a: 1,
    });
  });

  it("treats transparent as zero alpha", () => {
    expect(parseCssRgba("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe("isOpaqueCssColor", () => {
  it("accepts solid page greys and rejects clear fills", () => {
    expect(isOpaqueCssColor("rgb(237, 237, 237)")).toBe(true);
    expect(isOpaqueCssColor("rgba(0, 0, 0, 0)")).toBe(false);
    expect(isOpaqueCssColor("transparent")).toBe(false);
  });
});

describe("isLivelineLightOutline", () => {
  it("matches Liveline's hardcoded light tooltip stroke", () => {
    expect(isLivelineLightOutline("rgba(255, 255, 255, 0.95)")).toBe(true);
    expect(isLivelineLightOutline("rgb(255, 255, 255)")).toBe(true);
    expect(isLivelineLightOutline("#ffffff")).toBe(true);
  });

  it("leaves grid, crosshair, and page grey alone", () => {
    expect(isLivelineLightOutline("rgba(0, 0, 0, 0.12)")).toBe(false);
    expect(isLivelineLightOutline("rgb(237, 237, 237)")).toBe(false);
    expect(isLivelineLightOutline("rgba(30, 30, 30, 0.95)")).toBe(false);
  });
});
