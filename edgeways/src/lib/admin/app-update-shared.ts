import { MAX_BANNER_MESSAGE_LENGTH } from "@/lib/admin/maintenance-banner-shared";

export const APP_UPDATE_MODES = ["auto", "off", "force"] as const;
export type AppUpdateMode = (typeof APP_UPDATE_MODES)[number];

export type AppUpdateSettings = {
  mode: AppUpdateMode;
  message: string;
};

export const DEFAULT_APP_UPDATE_MESSAGE =
  "A new version of Edgeways is ready.";
export const DEFAULT_APP_UPDATE_LINK_LABEL = "Reload";

export const DEFAULT_APP_UPDATE: AppUpdateSettings = {
  mode: "auto",
  message: DEFAULT_APP_UPDATE_MESSAGE,
};

export const APP_UPDATE_MODE_LABEL: Record<AppUpdateMode, string> = {
  auto: "Auto",
  off: "Off",
  force: "Force",
};

export const APP_UPDATE_MODE_HINT: Record<AppUpdateMode, string> = {
  auto: "Show on open desks after a new deploy. They reload when they tap",
  off: "Never show on this environment",
  force: "Show now, for checking this environment only",
};

export const APP_UPDATE_CHANGE_EVENT = "edgeways:app-update";

export function isAppUpdateMode(value: unknown): value is AppUpdateMode {
  return (
    typeof value === "string" &&
    (APP_UPDATE_MODES as readonly string[]).includes(value)
  );
}

export function normalizeAppUpdate(
  input: Partial<AppUpdateSettings> | null | undefined
): AppUpdateSettings {
  const trimmed =
    typeof input?.message === "string" ? input.message.trim() : "";
  return {
    mode: isAppUpdateMode(input?.mode) ? input.mode : DEFAULT_APP_UPDATE.mode,
    message: (trimmed || DEFAULT_APP_UPDATE_MESSAGE).slice(
      0,
      MAX_BANNER_MESSAGE_LENGTH
    ),
  };
}

export function parseAppUpdate(raw: string | null | undefined): AppUpdateSettings {
  if (!raw) return { ...DEFAULT_APP_UPDATE };
  try {
    return normalizeAppUpdate(JSON.parse(raw) as Partial<AppUpdateSettings>);
  } catch {
    return { ...DEFAULT_APP_UPDATE };
  }
}

export function appUpdatesEqual(
  a: AppUpdateSettings,
  b: AppUpdateSettings
): boolean {
  return a.mode === b.mode && a.message === b.message;
}

/** Last visible copy to keep on screen while the bar is collapsing. */
export function appUpdateExitHold(
  previous: AppUpdateSettings | null,
  next: AppUpdateSettings,
  bootStamp: string | null | undefined,
  liveStamp: string | null | undefined
): AppUpdateSettings | null {
  if (appUpdateIsVisible(next, bootStamp, liveStamp)) return next;
  if (previous) return previous;
  return null;
}

export function appUpdateIsVisible(
  settings: AppUpdateSettings | null | undefined,
  bootStamp: string | null | undefined,
  liveStamp: string | null | undefined
): boolean {
  if (!settings) return false;
  if (settings.mode === "off") return false;
  if (settings.mode === "force") return Boolean(settings.message.trim());
  return Boolean(
    settings.message.trim() &&
      bootStamp &&
      liveStamp &&
      bootStamp !== liveStamp
  );
}

export function announceAppUpdate(settings: AppUpdateSettings): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppUpdateSettings>(APP_UPDATE_CHANGE_EVENT, {
      detail: normalizeAppUpdate(settings),
    })
  );
}

export type SiteChromePayload = {
  enabled: boolean;
  message: string;
  kind: string;
  href: string | null;
  linkLabel: string | null;
  buildStamp: string;
  update: AppUpdateSettings;
};

export function readBuildStampFromUnknown(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const stamp = (raw as { buildStamp?: unknown }).buildStamp;
  return typeof stamp === "string" && stamp.trim() ? stamp.trim() : null;
}

export function readAppUpdateFromUnknown(raw: unknown): AppUpdateSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APP_UPDATE };
  return normalizeAppUpdate((raw as { update?: Partial<AppUpdateSettings> }).update);
}
