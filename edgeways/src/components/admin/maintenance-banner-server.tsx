import { DEFAULT_APP_UPDATE } from "@/lib/admin/app-update-shared";
import { getAppBuildStamp } from "@/lib/admin/app-build-stamp";
import { DEFAULT_BANNER } from "@/lib/admin/maintenance-banner-shared";
import {
  readAppUpdateSettings,
  readMaintenanceBanner,
} from "@/lib/admin/operator-settings";
import { MaintenanceBannerLive } from "./maintenance-banner-live";

/**
 * Server-rendered site banner host: first paint matches the published
 * state, then the client polls and animates changes. Fail-soft — a
 * settings read failure must never take the desk down with it.
 */
export async function MaintenanceBannerServer() {
  const [banner, update] = await Promise.all([
    readMaintenanceBanner().catch(() => DEFAULT_BANNER),
    readAppUpdateSettings().catch(() => DEFAULT_APP_UPDATE),
  ]);
  return (
    <MaintenanceBannerLive
      initial={banner}
      initialUpdate={update}
      buildStamp={getAppBuildStamp()}
    />
  );
}
