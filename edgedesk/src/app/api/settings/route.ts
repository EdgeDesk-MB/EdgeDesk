import { NextResponse } from "next/server";
import { getAppSettings, patchAppSettings, type AppSettingsPatch } from "@/lib/services/settings";
import { normalizeMobileDeckPin } from "@/lib/services/settings-shared";
import { normalizeTimeFormat } from "@/lib/time-format";

export async function GET() {
  return NextResponse.json(getAppSettings());
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: AppSettingsPatch = {};

  if (typeof body.defaultBackStake === "number") patch.defaultBackStake = body.defaultBackStake;
  if (typeof body.defaultBetType === "string") {
    patch.defaultBetType = body.defaultBetType as AppSettingsPatch["defaultBetType"];
  }
  if (typeof body.defaultBookmaker === "string") patch.defaultBookmaker = body.defaultBookmaker;
  if (typeof body.offerRemindersEnabled === "boolean") {
    patch.offerRemindersEnabled = body.offerRemindersEnabled;
  }
  if (Array.isArray(body.offerReminderDays)) {
    patch.offerReminderDays = body.offerReminderDays.filter((d) => typeof d === "number");
  }
  if (typeof body.ocrAutoMatchEvents === "boolean") {
    patch.ocrAutoMatchEvents = body.ocrAutoMatchEvents;
  }
  if (typeof body.dashboardPollMs === "number") patch.dashboardPollMs = body.dashboardPollMs;
  if (typeof body.displayTimezone === "string") patch.displayTimezone = body.displayTimezone;
  if (typeof body.timeFormat === "string") patch.timeFormat = normalizeTimeFormat(body.timeFormat);
  if (typeof body.mobileDeckPin === "string") {
    patch.mobileDeckPin = normalizeMobileDeckPin(body.mobileDeckPin);
  }
  if (typeof body.alertsOfferExpiring === "boolean") {
    patch.alertsOfferExpiring = body.alertsOfferExpiring;
  }
  if (typeof body.alertsRaceOffSoon === "boolean") {
    patch.alertsRaceOffSoon = body.alertsRaceOffSoon;
  }
  if (typeof body.alertsResultSettled === "boolean") {
    patch.alertsResultSettled = body.alertsResultSettled;
  }
  if (typeof body.alertsNakedExposure === "boolean") {
    patch.alertsNakedExposure = body.alertsNakedExposure;
  }
  if (typeof body.alertsTwoUpLock === "boolean") {
    patch.alertsTwoUpLock = body.alertsTwoUpLock;
  }

  if (body.tuning && typeof body.tuning === "object" && !Array.isArray(body.tuning)) {
    // patchAppSettings merges and clamps via normalizeTuning
    patch.tuning = body.tuning as AppSettingsPatch["tuning"];
  }
  if (body.homeLayout && typeof body.homeLayout === "object" && !Array.isArray(body.homeLayout)) {
    // patchAppSettings merges and normalises via normalizeHomeLayout
    patch.homeLayout = body.homeLayout as AppSettingsPatch["homeLayout"];
  }
  if (typeof body.monthlyProfitTarget === "number" || body.monthlyProfitTarget === null) {
    patch.monthlyProfitTarget = body.monthlyProfitTarget;
  }

  if (body.offerBetPref && typeof body.offerBetPref === "object") {
    const pref = body.offerBetPref as Record<string, unknown>;
    const offerId = typeof pref.offerId === "number" ? pref.offerId : Number(pref.offerId);
    const stake = typeof pref.stake === "number" ? pref.stake : parseFloat(String(pref.stake ?? ""));
    if (Number.isFinite(offerId) && offerId > 0 && Number.isFinite(stake) && stake > 0) {
      patch.offerBetPref = {
        offerId,
        stake,
        bookmaker: typeof pref.bookmaker === "string" ? pref.bookmaker : "",
      };
    }
  }

  return NextResponse.json(patchAppSettings(patch));
}
