import { describe, expect, it } from "vitest";
import { accentFaviconDataUrl, buildAccentFaviconSvg } from "@/lib/brand/bolt-mark";

describe("buildAccentFaviconSvg", () => {
  it("paints the Amber plate and ink bolt by default", () => {
    const svg = buildAccentFaviconSvg("#FFC71E");
    expect(svg).toContain('fill="#FFC71E"');
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain("<path ");
  });

  it("flips the bolt to white on a dark plate", () => {
    const svg = buildAccentFaviconSvg("#2BB673");
    expect(svg).toContain('fill="#2BB673"');
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("builds a data URL for live favicon swaps", () => {
    const href = accentFaviconDataUrl("#3B82F6");
    expect(href.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(href)).toContain("#3B82F6");
  });
});
