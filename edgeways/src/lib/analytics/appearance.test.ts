import { describe, expect, it } from "vitest";
import {
  appearanceChangedFields,
  appearanceChangedProperties,
  appearancePersonProperties,
  appearanceSnapshotKey,
  isAppearanceCustomised,
} from "@/lib/analytics/appearance";

const defaults = {
  theme: "light" as const,
  headerPattern: "diagonal-lines",
  uiFont: "default",
  brandAccent: "amber",
};

describe("appearance analytics", () => {
  it("maps the live look without hex colours", () => {
    expect(
      appearancePersonProperties({
        theme: "dark",
        headerPattern: "hexagons",
        uiFont: "figtree",
        brandAccent: "coral",
      })
    ).toEqual({
      appearance_theme: "dark",
      appearance_header_pattern: "hexagons",
      appearance_ui_font: "figtree",
      appearance_brand_accent: "coral",
      appearance_customised: true,
    });
    expect(JSON.stringify(appearancePersonProperties({
      ...defaults,
      brandAccent: "custom",
    }))).not.toMatch(/#/);
  });

  it("treats the factory look as not customised", () => {
    expect(isAppearanceCustomised(defaults)).toBe(false);
    expect(isAppearanceCustomised({ ...defaults, theme: "dark" })).toBe(true);
    expect(isAppearanceCustomised({ ...defaults, uiFont: "figtree" })).toBe(true);
  });

  it("names only the fields that actually changed", () => {
    const next = { ...defaults, theme: "dark" as const, headerPattern: "hexagons" };
    expect(appearanceChangedFields(defaults, next)).toEqual(["theme", "header_pattern"]);
    expect(appearanceChangedProperties(defaults, next)).toEqual({
      appearance_theme: "dark",
      appearance_header_pattern: "hexagons",
      appearance_ui_font: "default",
      appearance_brand_accent: "amber",
      appearance_customised: true,
      appearance_changed_fields: ["theme", "header_pattern"],
    });
    expect(appearanceSnapshotKey(defaults)).not.toBe(appearanceSnapshotKey(next));
  });
});
