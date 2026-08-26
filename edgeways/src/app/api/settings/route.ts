import { NextResponse } from "next/server";
import type { AppSettingsPatch } from "@/lib/services/settings-merge";
import {
  normalizeDefaultSport,
  normalizeMobileDeckPin,
  normalizePlanPreview,
} from "@/lib/services/settings-shared";
import { normalizeTimeFormat } from "@/lib/time-format";
import { denyPublicDemoWrite } from "@/lib/demo/public-demo-guard";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  getNeonDeskSettings,
  patchNeonDeskSettings,
} from "@/lib/db/neon-desk-settings";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import { resolveEntitlementBilling } from "@/lib/entitlements/resolve-billing";

export const GET = withDeskScope(async function GET() {
  const billing = await resolveEntitlementBilling();
  if (isNeonDesk()) {
    const settings = await getNeonDeskSettings();
    return NextResponse.json({ ...settings, billing });
  }
  const { getAppSettings } = await import("@/lib/services/settings");
  return NextResponse.json({ ...getAppSettings(), billing });
});

export const PATCH = withDeskScope(async function PATCH(req: Request) {
  // EDGE-106: a demo session never writes live settings (previously only the
  // appearance keys were stripped - everything else still landed on the desk).
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  const body = (await req.json()) as Record<string, unknown>;
  const patch: AppSettingsPatch = {};

  if (typeof body.defaultBackStake === "number") patch.defaultBackStake = body.defaultBackStake;
  if (typeof body.defaultBetType === "string") {
    patch.defaultBetType = body.defaultBetType as AppSettingsPatch["defaultBetType"];
  }
  if (typeof body.defaultSport === "string") {
    patch.defaultSport = normalizeDefaultSport(body.defaultSport);
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
  if (typeof body.alertsFreeBetExpiring === "boolean") {
    patch.alertsFreeBetExpiring = body.alertsFreeBetExpiring;
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
  if (typeof body.digestWeekly === "boolean") {
    patch.digestWeekly = body.digestWeekly;
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
  if (typeof body.brandAccentPreset === "string") {
    patch.brandAccentPreset = body.brandAccentPreset;
  }
  if (typeof body.brandAccentHex === "string") {
    patch.brandAccentHex = body.brandAccentHex;
  }
  if (typeof body.uiFont === "string") {
    patch.uiFont = body.uiFont;
  }
  if (typeof body.headerPattern === "string") {
    patch.headerPattern = body.headerPattern;
  }
  if (typeof body.planPreview === "string") {
    patch.planPreview = normalizePlanPreview(body.planPreview);
  }
  if (typeof body.ageConfirmedAt === "number" || body.ageConfirmedAt === null) {
    patch.ageConfirmedAt = body.ageConfirmedAt;
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

  if (isNeonDesk()) {
    try {
      const next = await patchNeonDeskSettings(patch);
      const billing = await resolveEntitlementBilling();
      return NextResponse.json({ ...next, billing });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save settings.";
      if (message.includes("Sign in")) {
        return NextResponse.json({ error: message }, { status: 401 });
      }
      throw err;
    }
  }
  const { patchAppSettings } = await import("@/lib/services/settings");
  const next = patchAppSettings(patch);
  const billing = await resolveEntitlementBilling();
  return NextResponse.json({ ...next, billing });
});
