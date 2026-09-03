import { DEFAULT_BRAND_ACCENT_PRESET } from "@/lib/brand-accent";
import { DEFAULT_HEADER_PATTERN } from "@/lib/header-pattern-constants";
import { DEFAULT_UI_FONT } from "@/lib/ui-font-constants";

export type AppearanceTheme = "light" | "dark";

export type AppearanceAnalyticsSnapshot = {
  theme: AppearanceTheme;
  headerPattern: string;
  uiFont: string;
  brandAccent: string;
};

export type AppearanceChangedField =
  | "theme"
  | "header_pattern"
  | "ui_font"
  | "brand_accent";

/** Person properties for the live desk look. Preset ids only, never custom hex. */
export function appearancePersonProperties(snapshot: AppearanceAnalyticsSnapshot) {
  return {
    appearance_theme: snapshot.theme,
    appearance_header_pattern: snapshot.headerPattern,
    appearance_ui_font: snapshot.uiFont,
    appearance_brand_accent: snapshot.brandAccent,
    appearance_customised: isAppearanceCustomised(snapshot),
  };
}

export function isAppearanceCustomised(snapshot: AppearanceAnalyticsSnapshot): boolean {
  return (
    snapshot.theme !== "light" ||
    snapshot.headerPattern !== DEFAULT_HEADER_PATTERN ||
    snapshot.uiFont !== DEFAULT_UI_FONT ||
    snapshot.brandAccent !== DEFAULT_BRAND_ACCENT_PRESET
  );
}

export function appearanceSnapshotKey(snapshot: AppearanceAnalyticsSnapshot): string {
  return [
    snapshot.theme,
    snapshot.headerPattern,
    snapshot.uiFont,
    snapshot.brandAccent,
  ].join("|");
}

export function appearanceChangedFields(
  previous: AppearanceAnalyticsSnapshot,
  next: AppearanceAnalyticsSnapshot
): AppearanceChangedField[] {
  const fields: AppearanceChangedField[] = [];
  if (previous.theme !== next.theme) fields.push("theme");
  if (previous.headerPattern !== next.headerPattern) fields.push("header_pattern");
  if (previous.uiFont !== next.uiFont) fields.push("ui_font");
  if (previous.brandAccent !== next.brandAccent) fields.push("brand_accent");
  return fields;
}

export function appearanceChangedProperties(
  previous: AppearanceAnalyticsSnapshot,
  next: AppearanceAnalyticsSnapshot
) {
  return {
    ...appearancePersonProperties(next),
    appearance_changed_fields: appearanceChangedFields(previous, next),
  };
}

export function syncAppearancePersonProperties(snapshot: AppearanceAnalyticsSnapshot) {
  const properties = appearancePersonProperties(snapshot);
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.setPersonProperties(properties);
    })
    .catch(() => {
      /* analytics optional */
    });
}

export function captureAppearanceChanged(
  previous: AppearanceAnalyticsSnapshot,
  next: AppearanceAnalyticsSnapshot
) {
  const properties = appearanceChangedProperties(previous, next);
  if (properties.appearance_changed_fields.length === 0) return;
  void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.setPersonProperties(appearancePersonProperties(next));
      posthog.capture("appearance_changed", properties);
    })
    .catch(() => {
      /* analytics optional */
    });
}
