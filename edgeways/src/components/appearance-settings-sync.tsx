"use client";

/**
 * Apply SQLite appearance prefs as soon as /api/state lands — not only when
 * the Settings page mounts. Without this, home keeps cookie/localStorage
 * values until you open Settings, which can look like a late theme flash
 * (and fights extensions such as Dark Reader that rewrite CSS vars).
 */

import { useEffect } from "react";
import { useAppStateContext } from "@/components/app-state-provider";
import { useBrandAccent } from "@/components/brand-accent-provider";
import { useHeaderPattern } from "@/components/header-pattern-provider";
import { useUiFont } from "@/components/ui-font-provider";

export function AppearanceSettingsSync() {
  const { state } = useAppStateContext();
  const { syncFromSettings: syncAccent } = useBrandAccent();
  const { syncFromSettings: syncFont } = useUiFont();
  const { syncFromSettings: syncPattern } = useHeaderPattern();
  const settings = state?.settings;

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

  return null;
}
