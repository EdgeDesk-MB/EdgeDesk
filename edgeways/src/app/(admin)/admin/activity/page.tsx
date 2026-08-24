import { Activity } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadActivityOverview } from "@/lib/admin/activity";
import { loadFlagsLinks } from "@/lib/admin/flags";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminActivityPage() {
  const activity = await loadActivityOverview();
  const links = loadFlagsLinks();
  const bets = activity.rows.reduce((sum, row) => sum + row.bets, 0);
  const offers = activity.rows.reduce((sum, row) => sum + row.offers, 0);
  const history = activity.rows.reduce((sum, row) => sum + row.history, 0);

  return (
    <AdminPage
      title="Activity"
      description="Per-account desk volume. This is not another customer’s bets or wallets."
      icon={Activity}
      action={
        <Button variant="outline" {...pageSecondaryButtonProps} asChild>
          <a href={links.projectHomeUrl} target="_blank" rel="noreferrer">
            Open PostHog
          </a>
        </Button>
      }
    >
      <StatStrip columns={4}>
        <StatTile label="Accounts" value={String(activity.rows.length)} />
        <StatTile label="Bets" value={String(bets)} />
        <StatTile label="Offers" value={String(offers)} />
        <StatTile label="History" value={String(history)} />
      </StatStrip>
      {activity.rows.length > 0 && activity.note ? (
        <p className="text-sm text-muted-foreground">{activity.note}</p>
      ) : null}
      {activity.rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={activity.available ? "No accounts yet" : "Hosted desk needed"}
          description={
            activity.note ??
            "Accounts appear here after someone signs in on the hosted desk."
          }
        />
      ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>Bets</TableHead>
              <TableHead className={tableHeaderCell}>Offers</TableHead>
              <TableHead className={tableHeaderCell}>History</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.rows.map((row) => (
              <TableRow key={row.clerkUserId}>
                <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>
                  {row.email ?? row.clerkUserId}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "capitalize")}>{row.plan}</TableCell>
                <TableCell className={tableBodyCell}>{row.bets}</TableCell>
                <TableCell className={tableBodyCell}>{row.offers}</TableCell>
                <TableCell className={tableBodyCell}>{row.history}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
      )}
    </AdminPage>
  );
}
