/**
 * App-wide user preferences — stored as key/value in SQLite.
 */
import { eq } from "drizzle-orm";
import { db, appSettings } from "@/lib/db";

export interface AppSettings {
  defaultBackStake: number;
  defaultBetType: "qualifying" | "free_snr" | "free_sr" | "risk_free";
  defaultBookmaker: string;
  offerRemindersEnabled: boolean;
  offerReminderDays: number[];
  ocrAutoMatchEvents: boolean;
  dashboardPollMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultBackStake: 10,
  defaultBetType: "qualifying",
  defaultBookmaker: "",
  offerRemindersEnabled: true,
  offerReminderDays: [7, 3, 1],
  ocrAutoMatchEvents: true,
  dashboardPollMs: 3000,
};

function readRaw(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeRaw(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) {
    db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  } else {
    db.insert(appSettings).values({ key, value }).run();
  }
}

export function getAppSettings(): AppSettings {
  const stake = parseFloat(readRaw("defaultBackStake") ?? "");
  const poll = parseInt(readRaw("dashboardPollMs") ?? "", 10);
  let reminderDays = DEFAULT_SETTINGS.offerReminderDays;
  try {
    const parsed = JSON.parse(readRaw("offerReminderDays") ?? "[]") as number[];
    if (Array.isArray(parsed) && parsed.length > 0) reminderDays = parsed;
  } catch {
    /* keep default */
  }

  const betType = readRaw("defaultBetType");
  const validBetType =
    betType === "qualifying" ||
    betType === "free_snr" ||
    betType === "free_sr" ||
    betType === "risk_free"
      ? betType
      : DEFAULT_SETTINGS.defaultBetType;

  return {
    defaultBackStake: Number.isFinite(stake) && stake > 0 ? stake : DEFAULT_SETTINGS.defaultBackStake,
    defaultBetType: validBetType,
    defaultBookmaker: readRaw("defaultBookmaker") ?? DEFAULT_SETTINGS.defaultBookmaker,
    offerRemindersEnabled: readRaw("offerRemindersEnabled") !== "false",
    offerReminderDays: reminderDays,
    ocrAutoMatchEvents: readRaw("ocrAutoMatchEvents") !== "false",
    dashboardPollMs:
      Number.isFinite(poll) && poll >= 1000 && poll <= 60_000
        ? poll
        : DEFAULT_SETTINGS.dashboardPollMs,
  };
}

export function patchAppSettings(patch: Partial<AppSettings>): AppSettings {
  if (patch.defaultBackStake != null) writeRaw("defaultBackStake", String(patch.defaultBackStake));
  if (patch.defaultBetType != null) writeRaw("defaultBetType", patch.defaultBetType);
  if (patch.defaultBookmaker != null) writeRaw("defaultBookmaker", patch.defaultBookmaker);
  if (patch.offerRemindersEnabled != null) {
    writeRaw("offerRemindersEnabled", patch.offerRemindersEnabled ? "true" : "false");
  }
  if (patch.offerReminderDays != null) {
    writeRaw("offerReminderDays", JSON.stringify(patch.offerReminderDays));
  }
  if (patch.ocrAutoMatchEvents != null) {
    writeRaw("ocrAutoMatchEvents", patch.ocrAutoMatchEvents ? "true" : "false");
  }
  if (patch.dashboardPollMs != null) writeRaw("dashboardPollMs", String(patch.dashboardPollMs));
  return getAppSettings();
}
