import { Flag } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ReleasesPanel } from "@/components/admin/releases-panel";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { loadFlagsOverview } from "@/lib/admin/flags";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";

export default async function AdminReleasesPage() {
  const [flags, banner] = await Promise.all([
    loadFlagsOverview(),
    readMaintenanceBanner(),
  ]);
  const flagsOn = flags.flags.filter((flag) => flag.active).length;
  return (
    <AdminPage
      title="Releases"
      description="PostHog flags and an optional maintenance banner. There is no deploy button."
      icon={Flag}
    >
      <StatStrip columns={3}>
        <StatTile
          label="Flags"
          value={String(flags.flags.length)}
          sub={`${flagsOn} on`}
        />
        <StatTile label="Banner" value={banner.enabled ? "On" : "Off"} />
        <StatTile label="PostHog" value={flags.configured ? "Linked" : "Unset"} />
      </StatStrip>
      <ReleasesPanel flags={flags} banner={banner} />
    </AdminPage>
  );
}
