import { Shield } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminAccountFilters } from "@/components/admin/admin-account-filters";
import { UsersManager } from "@/components/admin/users-manager";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import { scopeAdminUsers } from "@/lib/admin/exclude-accounts";
import { hiddenAdminsSub, withoutAdmins } from "@/lib/admin/exclude-admins";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { listAppUsers } from "@/lib/services/app-users";

export default async function AdminUsersPage() {
  const [users, scope] = await Promise.all([
    listAppUsers(),
    loadAdminAccountScope(),
  ]);
  const { excludeAdmins, excludedIds } = scope;
  const admins = users.filter((user) => user.admin).length;
  const listedUsers = withoutAdmins(users, excludeAdmins);
  const visibleUsers = scopeAdminUsers(users, { excludeAdmins, excludedIds });
  const excludedCount = excludedIds.length;
  const bootstrap = users.filter((user) => user.bootstrap).length;
  const growth = buildAccountGrowth(visibleUsers, []);
  return (
    <AdminPage
      title="User management"
      description="Grant or revoke the operator role, and hide test accounts from every /admin stat. Test accounts stay on this list so you can include them again."
      icon={Shield}
      toolbar={
        <AdminAccountFilters
          excludeAdmins={excludeAdmins}
          adminCount={admins}
          excludedCount={excludedCount}
          showExcludedLink={false}
        />
      }
    >
      <StatStrip columns={4}>
        <StatTile
          label="Accounts"
          value={String(listedUsers.length)}
          sub={hiddenAdminsSub(admins, excludeAdmins)}
        />
        <StatTile
          label="Admins"
          value={String(admins)}
          sub={excludeAdmins ? "Hidden from the list" : undefined}
        />
        <StatTile
          label="Test accounts"
          value={String(excludedCount)}
          sub={excludedCount > 0 ? "Hidden from other pages" : "None yet"}
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
        initialUsers={listedUsers}
        initialExcludedIds={excludedIds}
      />
    </AdminPage>
  );
}
