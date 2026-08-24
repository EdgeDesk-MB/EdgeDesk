import { Radio } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { FeedsPanel } from "@/components/admin/feeds-panel";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { loadFeedStatus } from "@/lib/admin/feeds";

export default async function AdminFeedsPage() {
  const status = await loadFeedStatus();
  const exchangeOk = status.exchange.providers.filter((provider) => provider.ok).length;
  return (
    <AdminPage
      title="Feed health"
      description="Operator-held football, racing and exchange feeds. Customers do not add keys."
      icon={Radio}
    >
      <StatStrip columns={3}>
        <StatTile
          label="Football"
          value={
            status.football.configured
              ? `${status.football.used}/${status.football.budget}`
              : "Off"
          }
          sub="Requests today"
        />
        <StatTile
          label="Racing"
          value={status.racing.configured ? String(status.racing.used) : "Off"}
          sub="Requests today"
        />
        <StatTile
          label="Exchange"
          value={`${exchangeOk} live`}
          sub={`${status.exchange.providers.length} provider${status.exchange.providers.length === 1 ? "" : "s"}`}
        />
      </StatStrip>
      <FeedsPanel initial={status} />
    </AdminPage>
  );
}
