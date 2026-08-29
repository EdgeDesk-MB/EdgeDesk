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
import { AdminLiveSettingsCard } from "@/components/admin/admin-live-settings-card";
import { UsersManager } from "@/components/admin/users-manager";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import { scopeAdminUsers } from "@/lib/admin/exclude-accounts";
import { hiddenAdminsSub, withoutAdmins } from "@/lib/admin/exclude-admins";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { readAdminLiveSettings } from "@/lib/admin/live-settings";
import { requireAdminPage } from "@/lib/admin/session";
import { listAppUsers } from "@/lib/services/app-users";

export default async function AdminUsersPage() {
  const [session, users, scope, liveSettings] = await Promise.all([
    requireAdminPage(),
    listAppUsers(),
    loadAdminAccountScope(),
    readAdminLiveSettings(),
  ]);
  const { excludeAdmins, excludedIds } = scope;
  const admins = users.filter((user) => user.admin).length;
  const listedUsers = withoutAdmins(users, excludeAdmins);
  const visibleUsers = scopeAdminUsers(users, { excludeAdmins, excludedIds });
  const excludedCount = excludedIds.length;
  const bootstrap = users.filter((user) => user.bootstrap).length;
  const owners = users.filter((user) => user.owner).length;
  const growth = buildAccountGrowth(visibleUsers, []);
  return (
    <AdminPage
      title="User management"
      description="Grant admin, hide test accounts and tune live alerts."
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
      <StatStrip columns={5}>
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
          label="Owner"
          value={String(owners)}
          sub="Cannot demote"
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
          description="Operator admin versus customer. The owner and bootstrap operators cannot be demoted."
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
      {session.owner ? <AdminLiveSettingsCard initial={liveSettings} /> : null}
      <UsersManager
        key={excludeAdmins ? "customers" : "all"}
        initialUsers={listedUsers}
        initialExcludedIds={excludedIds}
      />
    </AdminPage>
  );
}
