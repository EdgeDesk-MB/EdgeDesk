import { Users } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { listAppUsers } from "@/lib/services/app-users";
import { listWaitlistSignups } from "@/lib/services/waitlist-store";
import { sectionTitle, tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminSubscribersPage() {
  const [users, waitlist] = await Promise.all([
    listAppUsers(),
    listWaitlistSignups(200),
  ]);
  const waitlistEmails = new Set(waitlist.map((row) => row.email.toLowerCase()));
  const waitlistToPaid = users.filter(
    (user) =>
      user.email &&
      waitlistEmails.has(user.email.toLowerCase()) &&
      (user.plan === "core" || user.plan === "edge")
  ).length;
  const confirmed = waitlist.filter((row) => row.confirmedAt && !row.unsubscribedAt).length;

  return (
    <AdminPage
      title="Subscribers"
      description="Account plans from app_users, plus the waitlist. Last active is the last account sync."
      icon={Users}
    >
      <StatStrip columns={4}>
        <StatTile label="Accounts" value={String(users.length)} />
        <StatTile
          label="Core + Edge"
          value={String(users.filter((u) => u.plan === "core" || u.plan === "edge").length)}
        />
        <StatTile label="Waitlist" value={String(waitlist.length)} sub={`${confirmed} confirmed`} />
        <StatTile label="Waitlist to paid" value={String(waitlistToPaid)} />
      </StatStrip>

      <section>
        <h2 className={sectionTitle}>Accounts</h2>
        {users.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No accounts yet"
            description="Accounts appear here after someone signs in."
          />
        ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>Billing</TableHead>
              <TableHead className={tableHeaderCell}>Signed up</TableHead>
              <TableHead className={tableHeaderCell}>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {users.map((user) => (
                <TableRow key={user.clerkUserId}>
                  <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>
                    {user.email ?? user.clerkUserId}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "capitalize")}>
                    {user.plan}
                    {user.founding ? " · founding" : ""}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "capitalize")}>
                    {user.billingStatus.replace("_", " ")}
                  </TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDate(user.createdAt)}</TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDateTime(user.updatedAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        )}
      </section>

      <section>
        <h2 className={sectionTitle}>Waitlist</h2>
        {waitlist.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No waitlist signups yet"
            description="Confirmed and unsubscribed rows appear here once people join."
          />
        ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Signed up</TableHead>
              <TableHead className={tableHeaderCell}>Confirmed</TableHead>
              <TableHead className={tableHeaderCell}>Unsubscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {waitlist.map((row) => (
                <TableRow key={row.email}>
                  <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>{row.email}</TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDateTime(row.createdAt)}</TableCell>
                  <TableCell className={tableBodyCell}>
                    {row.confirmedAt ? formatAdminDateTime(row.confirmedAt) : "—"}
                  </TableCell>
                  <TableCell className={tableBodyCell}>
                    {row.unsubscribedAt ? formatAdminDateTime(row.unsubscribedAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        )}
      </section>
    </AdminPage>
  );
}
