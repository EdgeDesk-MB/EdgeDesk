import {
  DEFAULT_LIVE_BUNDLE_CONFIG,
  type LiveBundleConfig,
} from "@/lib/admin/live-bundle";

export type AdminLiveSettings = {
  toastsEnabled: boolean;
  pushEnabled: boolean;
  pollMs: number;
  bundleStart: number;
  bundleHigh: number;
  windowMinutes: number;
};

export const DEFAULT_ADMIN_LIVE_SETTINGS: AdminLiveSettings = {
  toastsEnabled: true,
  pushEnabled: true,
  pollMs: 5000,
  bundleStart: DEFAULT_LIVE_BUNDLE_CONFIG.bundleStart,
  bundleHigh: DEFAULT_LIVE_BUNDLE_CONFIG.bundleHigh,
  windowMinutes: 60,
};

export type AdminLivePushCursor = {
  since: number;
  critical: Record<string, "warning" | "error">;
};

export const EMPTY_ADMIN_LIVE_PUSH_CURSOR: AdminLivePushCursor = {
  since: 0,
  critical: {},
};

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function parseAdminLiveSettings(
  raw: string | null | undefined
): AdminLiveSettings {
  if (!raw) return { ...DEFAULT_ADMIN_LIVE_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<AdminLiveSettings>;
    const bundleStart = clampInt(
      parsed.bundleStart,
      DEFAULT_ADMIN_LIVE_SETTINGS.bundleStart,
      2,
      100
    );
    const bundleHigh = clampInt(
      parsed.bundleHigh,
      DEFAULT_ADMIN_LIVE_SETTINGS.bundleHigh,
      bundleStart,
      1000
    );
    return {
      toastsEnabled:
        typeof parsed.toastsEnabled === "boolean"
          ? parsed.toastsEnabled
          : DEFAULT_ADMIN_LIVE_SETTINGS.toastsEnabled,
      pushEnabled:
        typeof parsed.pushEnabled === "boolean"
          ? parsed.pushEnabled
          : DEFAULT_ADMIN_LIVE_SETTINGS.pushEnabled,
      pollMs: clampInt(
        parsed.pollMs,
        DEFAULT_ADMIN_LIVE_SETTINGS.pollMs,
        3000,
        60_000
      ),
      bundleStart,
      bundleHigh,
      windowMinutes: clampInt(
        parsed.windowMinutes,
        DEFAULT_ADMIN_LIVE_SETTINGS.windowMinutes,
        5,
        24 * 60
      ),
    };
  } catch {
    return { ...DEFAULT_ADMIN_LIVE_SETTINGS };
  }
}

export function liveBundleConfigFromSettings(
  settings: AdminLiveSettings
): LiveBundleConfig {
  return {
    bundleStart: settings.bundleStart,
    bundleHigh: settings.bundleHigh,
    windowMs: settings.windowMinutes * 60_000,
  };
}

export function parseAdminLivePushCursor(
  raw: string | null | undefined
): AdminLivePushCursor {
  if (!raw) return { ...EMPTY_ADMIN_LIVE_PUSH_CURSOR, critical: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<AdminLivePushCursor>;
    const since =
      typeof parsed.since === "number" && Number.isFinite(parsed.since)
        ? Math.max(0, Math.floor(parsed.since))
        : 0;
    const critical: AdminLivePushCursor["critical"] = {};
    if (parsed.critical && typeof parsed.critical === "object") {
      for (const [key, state] of Object.entries(parsed.critical)) {
        if (state === "warning" || state === "error") critical[key] = state;
      }
    }
    return { since, critical };
  } catch {
    return { ...EMPTY_ADMIN_LIVE_PUSH_CURSOR, critical: {} };
  }
}
