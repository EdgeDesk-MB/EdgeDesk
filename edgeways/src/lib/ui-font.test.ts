import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_FONT,
  isUiFontId,
  normalizeUiFont,
  UI_FONT_OPTIONS,
} from "@/lib/ui-font";

describe("ui-font", () => {
  it("accepts known ids", () => {
    expect(isUiFontId("default")).toBe(true);
    expect(isUiFontId("figtree")).toBe(true);
    expect(isUiFontId("comic-sans")).toBe(false);
    expect(isUiFontId(undefined)).toBe(false);
  });

  it("normalises unknown values to default", () => {
    expect(normalizeUiFont("figtree")).toBe("figtree");
    expect(normalizeUiFont("nope")).toBe(DEFAULT_UI_FONT);
    expect(normalizeUiFont(null)).toBe("default");
  });

  it("exposes Default and Figtree options", () => {
    expect(UI_FONT_OPTIONS.map((o) => o.id)).toEqual(["default", "figtree"]);
  });
});
