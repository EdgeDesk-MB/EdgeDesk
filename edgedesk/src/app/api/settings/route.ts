import { NextResponse } from "next/server";
import { getAppSettings, patchAppSettings } from "@/lib/services/settings";

export async function GET() {
  return NextResponse.json(getAppSettings());
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Parameters<typeof patchAppSettings>[0] = {};

  if (typeof body.defaultBackStake === "number") patch.defaultBackStake = body.defaultBackStake;
  if (typeof body.defaultBetType === "string") {
    patch.defaultBetType = body.defaultBetType as typeof patch.defaultBetType;
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

  return NextResponse.json(patchAppSettings(patch));
}
