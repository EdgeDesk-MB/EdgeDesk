import { Shield } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { ExcludeAdminsToggle } from "@/components/admin/exclude-admins-toggle";
import { UsersManager } from "@/components/admin/users-manager";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { readExcludeAdmins } from "@/lib/admin/exclude-admins-server";
import { hiddenAdminsSub, withoutAdmins } from "@/lib/admin/exclude-admins";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { listAppUsers } from "@/lib/services/app-users";

export default async function AdminUsersPage() {
  const [users, excludeAdmins] = await Promise.all([
    listAppUsers(),
    readExcludeAdmins(),
  ]);
  const admins = users.filter((user) => user.admin).length;
  const visibleUsers = withoutAdmins(users, excludeAdmins);
  const bootstrap = users.filter((user) => user.bootstrap).length;
  const growth = buildAccountGrowth(visibleUsers, []);
  return (
    <AdminPage
      title="User management"
      description="Grant or revoke the operator role. The bootstrap email cannot be demoted."
      icon={Shield}
      toolbar={
        <ExcludeAdminsToggle active={excludeAdmins} hiddenCount={admins} />
      }
    >
      <StatStrip columns={3}>
        <StatTile
          label="Accounts"
          value={String(visibleUsers.length)}
          sub={hiddenAdminsSub(admins, excludeAdmins)}
        />
        <StatTile
          label="Admins"
          value={String(admins)}
          sub={excludeAdmins ? "Hidden from the list" : undefined}
        />
        <StatTile label="Bootstrap" value={String(bootstrap)} sub="Cannot demote" />
      </StatStrip>
      <AdminCompareStrip
        heading="Versus last period"
        items={[
          { label: "This week", compare: growth.week.signups, period: "week" },
          { label: "This month", compare: growth.month.signups, period: "month" },
        ]}
      />
      <AdminChartGrid>
        <AdminChartCard
          title="Last sync recency"
          description="Age of each account's last app_users update. Not a session count."
        >
          <AdminDonutChart slices={growth.recencyShare} label="Last sync recency" />
        </AdminChartCard>
        <AdminChartCard
          title="Admins"
          description="Admin is the operator role. Bootstrap cannot be demoted."
        >
          <AdminDonutChart slices={growth.roleShare} label="Admins" />
        </AdminChartCard>
      </AdminChartGrid>
      <AdminChartCard
        title="Account signups"
        description="New accounts per UTC day. Quiet days stay on the chart."
      >
        <AdminBarChart series={growth.signups30} label="Account signups" />
      </AdminChartCard>
      <UsersManager
        key={excludeAdmins ? "customers" : "all"}
        initialUsers={visibleUsers}
      />
    </AdminPage>
  );
}
