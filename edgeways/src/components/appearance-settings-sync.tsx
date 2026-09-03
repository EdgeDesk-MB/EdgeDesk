"use client";

/**
 * Apply SQLite appearance prefs as soon as /api/state lands — not only when
 * the Settings page mounts. Without this, home keeps cookie/localStorage
 * values until you open Settings, which can look like a late theme flash
 * (and fights extensions such as Dark Reader that rewrite CSS vars).
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  appearanceSnapshotKey,
  captureAppearanceChanged,
  syncAppearancePersonProperties,
  type AppearanceAnalyticsSnapshot,
} from "@/lib/analytics/appearance";
import { useAppStateContext } from "@/components/app-state-provider";
import { useBrandAccent } from "@/components/brand-accent-provider";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { useHeaderPattern } from "@/components/header-pattern-provider";
import { useUiFont } from "@/components/ui-font-provider";

export function AppearanceSettingsSync() {
  const { state } = useAppStateContext();
  const { syncFromSettings: syncAccent } = useBrandAccent();
  const { syncFromSettings: syncFont } = useUiFont();
  const { syncFromSettings: syncPattern } = useHeaderPattern();
  const { theme, resolvedTheme } = useTheme();
  const publicDemo = usePublicDemo();
  const settings = state?.settings;
  const [themeReady, setThemeReady] = useState(false);
  const lastSnapshot = useRef<AppearanceAnalyticsSnapshot | null>(null);

  useEffect(() => {
    queueMicrotask(() => setThemeReady(true));
  }, []);

  useEffect(() => {
    if (!settings) return;
    syncAccent(settings.brandAccentPreset, settings.brandAccentHex);
  }, [settings?.brandAccentPreset, settings?.brandAccentHex, settings, syncAccent]);

  useEffect(() => {
    if (!settings) return;
    syncFont(settings.uiFont);
  }, [settings?.uiFont, settings, syncFont]);

  useEffect(() => {
    if (!settings) return;
    syncPattern(settings.headerPattern);
  }, [settings?.headerPattern, settings, syncPattern]);

  const appearanceTheme: AppearanceAnalyticsSnapshot["theme"] | null =
    !themeReady
      ? null
      : theme === "dark" || theme === "light"
        ? theme
        : resolvedTheme === "dark" || resolvedTheme === "light"
          ? resolvedTheme
          : null;

  useEffect(() => {
    if (publicDemo.active || !settings || !appearanceTheme) return;
    const snapshot: AppearanceAnalyticsSnapshot = {
      theme: appearanceTheme,
      headerPattern: settings.headerPattern,
      uiFont: settings.uiFont,
      brandAccent: settings.brandAccentPreset,
    };
    const previous = lastSnapshot.current;
    if (previous && appearanceSnapshotKey(previous) === appearanceSnapshotKey(snapshot)) {
      return;
    }
    if (!previous) {
      lastSnapshot.current = snapshot;
      syncAppearancePersonProperties(snapshot);
      return;
    }
    lastSnapshot.current = snapshot;
    captureAppearanceChanged(previous, snapshot);
  }, [
    appearanceTheme,
    publicDemo.active,
    settings,
    settings?.brandAccentPreset,
    settings?.headerPattern,
    settings?.uiFont,
  ]);

  return null;
}
