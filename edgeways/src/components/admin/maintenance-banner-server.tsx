import { readMaintenanceBanner } from "@/lib/admin/operator-settings";
import { MaintenanceBannerView } from "./maintenance-banner";

/**
 * Server-rendered maintenance banner: shows on first paint instead of
 * popping in after a client fetch. Fail-soft — a settings read failure
 * must never take the desk down with it.
 */
export async function MaintenanceBannerServer() {
  const banner = await readMaintenanceBanner().catch(() => null);
  if (!banner?.enabled || !banner.message) return null;
  return <MaintenanceBannerView message={banner.message} />;
}
