import { Shield } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { UsersManager } from "@/components/admin/users-manager";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { listAppUsers } from "@/lib/services/app-users";

export default async function AdminUsersPage() {
  const users = await listAppUsers();
  const admins = users.filter((user) => user.admin).length;
  const bootstrap = users.filter((user) => user.bootstrap).length;
  return (
    <AdminPage
      title="User management"
      description="Grant or revoke the operator role. The bootstrap email cannot be demoted."
      icon={Shield}
    >
      <StatStrip columns={3}>
        <StatTile label="Accounts" value={String(users.length)} />
        <StatTile label="Admins" value={String(admins)} />
        <StatTile label="Bootstrap" value={String(bootstrap)} sub="Cannot demote" />
      </StatStrip>
      <UsersManager initialUsers={users} />
    </AdminPage>
  );
}
