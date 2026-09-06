import { NextResponse } from "next/server";
import { getAppBuildStamp } from "@/lib/admin/app-build-stamp";
import {
  readAppUpdateSettings,
  readMaintenanceBanner,
} from "@/lib/admin/operator-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [banner, update] = await Promise.all([
    readMaintenanceBanner(),
    readAppUpdateSettings(),
  ]);
  return NextResponse.json({
    ...banner,
    buildStamp: getAppBuildStamp(),
    update,
  });
}
