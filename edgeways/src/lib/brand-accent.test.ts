import { describe, expect, it } from "vitest";
import {
  boostBrandForLightLogo,
  BRAND_HIGHLIGHT_MAX_LUMINANCE,
  BRAND_LUMINANCE_THRESHOLD,
  BRAND_TEXT_MIN_LUMINANCE,
  contrastInkOrWhite,
  deriveBrandAccent,
  ensureBrandOnLight,
  ensureBrandTextOnDark,
  mutedForegroundOn,
  normalizeHex,
  relativeLuminance,
} from "@/lib/brand-accent";

describe("brand-accent contrast", () => {
  it("normalizes hex", () => {
    expect(normalizeHex("ffc71e")).toBe("#FFC71E");
    expect(normalizeHex("#2bb673")).toBe("#2BB673");
    expect(normalizeHex("nope")).toBeNull();
  });

  it("treats amber as a light plate (ink on brand)", () => {
    expect(relativeLuminance("#FFC71E")).toBeGreaterThan(BRAND_LUMINANCE_THRESHOLD);
    expect(contrastInkOrWhite("#FFC71E")).toBe("#111111");
    expect(mutedForegroundOn("#FFC71E")).toBe("#111111");
  });

  it("treats viridian as a dark plate (white on brand)", () => {
    expect(relativeLuminance("#2BB673")).toBeLessThan(BRAND_LUMINANCE_THRESHOLD);
    expect(contrastInkOrWhite("#2BB673")).toBe("#FFFFFF");
    expect(mutedForegroundOn("#2BB673")).toBe("#FFFFFF");
  });

  it("boosts light-mode logo vibrance vs raw brand", () => {
    const boosted = boostBrandForLightLogo("#2BB673");
    expect(boosted).toMatch(/^#[0-9A-F]{6}$/);
    expect(boosted).not.toBe("#2BB673");
    expect(relativeLuminance(boosted)).toBeGreaterThan(relativeLuminance("#2BB673"));
  });

  it("keeps light brand-text as the raw colour", () => {
    expect(ensureBrandTextOnDark("#FFC71E")).toBe("#FFC71E");
  });

  it("lifts dark brand-text above the readable luminance floor", () => {
    const text = ensureBrandTextOnDark("#2BB673");
    expect(text).not.toBe("#2BB673");
    expect(relativeLuminance(text)).toBeGreaterThanOrEqual(BRAND_TEXT_MIN_LUMINANCE);
  });

  it("keeps mid/dark brand-highlight as the raw colour", () => {
    expect(ensureBrandOnLight("#2BB673")).toBe("#2BB673");
  });

  it("darkens bright brand-highlight below the light-surface ceiling", () => {
    const highlight = ensureBrandOnLight("#FFC71E");
    expect(highlight).not.toBe("#FFC71E");
    expect(relativeLuminance(highlight)).toBeLessThanOrEqual(
      BRAND_HIGHLIGHT_MAX_LUMINANCE
    );
    const washed = ensureBrandOnLight("#E8FFF0");
    expect(washed).not.toBe("#E8FFF0");
    expect(relativeLuminance(washed)).toBeLessThanOrEqual(
      BRAND_HIGHLIGHT_MAX_LUMINANCE
    );
  });

  it("deriveBrandAccent wires text + foreground contrast roles", () => {
    const amber = deriveBrandAccent("#FFC71E");
    expect(amber.brand).toBe("#FFC71E");
    expect(amber.brandText).toBe("#FFC71E");
    expect(amber.brandHighlight).not.toBe("#FFC71E");
    expect(relativeLuminance(amber.brandHighlight)).toBeLessThanOrEqual(
      BRAND_HIGHLIGHT_MAX_LUMINANCE
    );
    expect(amber.brandForeground).toBe("#111111");
    expect(amber.brandOnTopbar).toBe("#111111");
    expect(amber.topbarMutedOnBrand).toBe("#111111");
    expect(amber.brandPlateDark).toBe(false);
    expect(amber.brandLogoForeground).toBe("#111111");
    expect(amber.topbarAccentFaceShadow).toBe("var(--ew-btn-shadow)");

    const viridian = deriveBrandAccent("#2BB673");
    expect(viridian.brandOnTopbar).toBe("#FFFFFF");
    expect(viridian.brandForeground).toBe("#FFFFFF");
    expect(viridian.topbarMutedOnBrand).toBe("#FFFFFF");
    expect(viridian.brandText).not.toBe("#2BB673");
    expect(relativeLuminance(viridian.brandText)).toBeGreaterThanOrEqual(
      BRAND_TEXT_MIN_LUMINANCE
    );
    expect(viridian.brandHighlight).toBe("#2BB673");
    expect(viridian.brandLogo).not.toBe("#2BB673");
    expect(viridian.brandPlateDark).toBe(true);
    // Logo boost can cross the plate threshold — Login uses logo contrast/face
    expect(viridian.brandLogoForeground).toBe("#111111");
    expect(viridian.topbarAccentFaceShadow).toBe("var(--ew-btn-shadow)");
  });
});
