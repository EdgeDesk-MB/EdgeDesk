import { Pin } from "lucide-react";
import {
  AdminChartCard,
  AdminChartGrid,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  footballPinLabel,
  racingPinLabel,
  type ActivityPinView,
} from "@/lib/admin/activity-pins";
import {
  adminTableCompactMax,
  sectionStack,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function PinList({
  ids,
  kind,
}: {
  ids: string[];
  kind: "football" | "racing";
}) {
  if (ids.length === 0) return "—";
  const label = ids
    .map((id) => (kind === "football" ? footballPinLabel(id) : racingPinLabel(id)))
    .join(", ");
  return (
    <p className="min-w-0 text-pretty break-words" title={label}>
      {label}
    </p>
  );
}

export function AdminActivityPins({
  view,
  available,
  filteredOut = false,
  compact = false,
}: {
  view: ActivityPinView;
  available: boolean;
  filteredOut?: boolean;
  compact?: boolean;
}) {
  const table = (
    <AdminTableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={tableHeaderCell}>Email</TableHead>
            <TableHead className={tableHeaderCell}>Plan</TableHead>
            <TableHead className={tableHeaderCell}>Competitions</TableHead>
            <TableHead className={tableHeaderCell}>Courses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.rows.map((row) => (
            <TableRow key={row.clerkUserId}>
              <TableCell
                className={cn(tableBodyCell, "max-w-[18rem] truncate")}
                title={row.email ?? row.clerkUserId}
              >
                {row.email ?? row.clerkUserId}
              </TableCell>
              <TableCell className={cn(tableBodyCell, "capitalize")}>
                {row.plan}
              </TableCell>
              <TableCell
                className={cn(tableBodyCell, "min-w-0 whitespace-normal")}
              >
                <PinList ids={row.football} kind="football" />
              </TableCell>
              <TableCell
                className={cn(tableBodyCell, "min-w-0 whitespace-normal")}
              >
                <PinList ids={row.racing} kind="racing" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableFrame>
  );

  const empty = (
    <EmptyState
      compact
      icon={Pin}
      title={!available ? "Hosted desk needed" : "Nobody has pinned yet"}
      description={
        !available
          ? "Pins live on hosted desk settings. Set DATABASE_URL to read them."
          : filteredOut
            ? "Turn off Exclude admins, or include test accounts on Users, to see pinned desks."
            : "A desk appears here after someone pins a competition on Fixtures or a course on Racing Desk."
      }
    />
  );

  if (compact) {
    return (
      <Card className="min-w-0">
        <CardHeader className="gap-2">
          <CardTitle className="text-base">Pins</CardTitle>
          <CardDescription compact>
            Current pins on each hosted desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view.desksWithPins === 0 ? (
            empty
          ) : (
            <div className="flex flex-col gap-[var(--layout-stack-gap-compact)]">
              <AdminShareBars
                slices={view.footballShare}
                emptyTitle="No football pins"
                emptyDescription="Nobody has pinned a competition yet."
              />
              <ScrollFadeEdges
                scrollClassName={adminTableCompactMax}
                orientation="vertical"
                fadeClassName="from-card"
              >
                {table}
              </ScrollFadeEdges>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <AdminSection
      title="Pinned competitions and courses"
      description="Current pins on each hosted desk. Not a history of pin taps."
    >
      <div className={sectionStack}>
        {view.desksWithPins === 0 ? (
          empty
        ) : (
          <>
            <AdminChartGrid>
              <AdminChartCard
                title="Popular competitions"
                description="How many desks pinned each football competition."
              >
                <AdminShareBars
                  slices={view.footballShare}
                  emptyTitle="No football pins"
                  emptyDescription="Nobody has pinned a competition yet."
                />
              </AdminChartCard>
              <AdminChartCard
                title="Popular courses"
                description="How many desks pinned each racing course."
              >
                <AdminShareBars
                  slices={view.racingShare}
                  emptyTitle="No racing pins"
                  emptyDescription="Nobody has pinned a course yet."
                />
              </AdminChartCard>
            </AdminChartGrid>
            {table}
          </>
        )}
      </div>
    </AdminSection>
  );
}
