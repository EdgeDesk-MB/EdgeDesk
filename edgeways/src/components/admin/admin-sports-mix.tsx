import { Activity } from "lucide-react";
import {
  AdminChartCard,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SportDeskRow } from "@/lib/admin/activity-mix";
import type { ShareSlice } from "@/lib/admin/series";
import { shareTotal } from "@/lib/admin/series";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const SPORTS_NOTE =
  "From the linked event, then the bet, then the campaign, then the market. Counts only.";
const SPORTS_EMPTY =
  "Sports appear here after someone logs a bet on a hosted desk.";

export function AdminSportsMix({
  slices,
  rows,
}: {
  slices: ShareSlice[];
  rows: SportDeskRow[];
}) {
  if (shareTotal(slices) <= 0) {
    return (
      <AdminSection title="Sports" description={SPORTS_NOTE}>
        <EmptyState
          compact
          icon={Activity}
          title="No sports yet"
          description={SPORTS_EMPTY}
        />
      </AdminSection>
    );
  }

  return (
    <AdminSection title="Sports" description={SPORTS_NOTE}>
      <div className="flex flex-col gap-4">
        <AdminChartCard
          title="Sports on bets"
          description="Fleet share of logged bets. Not stakes, wallets, or P&L."
        >
          <AdminShareBars
            slices={slices}
            emptyTitle="No sports yet"
            emptyDescription={SPORTS_EMPTY}
          />
        </AdminChartCard>
        <AdminTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={tableHeaderCell}>Sport</TableHead>
                <TableHead className={cn(tableHeaderCell, "text-right")}>
                  Bets
                </TableHead>
                <TableHead className={cn(tableHeaderCell, "text-right")}>
                  Desks
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell
                    className={cn(
                      tableBodyCell,
                      "min-w-0 whitespace-normal text-pretty break-words"
                    )}
                    title={row.label}
                  >
                    {row.label}
                  </TableCell>
                  <TableCell
                    className={cn(tableBodyCell, "text-right tabular-nums")}
                  >
                    {row.bets}
                  </TableCell>
                  <TableCell
                    className={cn(tableBodyCell, "text-right tabular-nums")}
                  >
                    {row.desks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableFrame>
      </div>
    </AdminSection>
  );
}
