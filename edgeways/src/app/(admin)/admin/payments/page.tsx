import { CreditCard } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { ExcludeAdminsToggle } from "@/components/admin/exclude-admins-toggle";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  buildFoundingShare,
  chartsFromStripeOverview,
  formatPenceGbp,
} from "@/lib/admin/stripe-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime } from "@/lib/admin/format";
import { readExcludeAdmins } from "@/lib/admin/exclude-admins-server";
import { withoutAdmins } from "@/lib/admin/exclude-admins";
import { buildStripeDrift, stripeDriftNote } from "@/lib/admin/stripe-drift";
import { loadStripeOverview, stripeInvoiceUrl } from "@/lib/admin/stripe-overview";
import { StripeModeChip } from "@/components/admin/stripe-mode-chip";
import { listAppUsers } from "@/lib/services/app-users";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminPaymentsPage() {
  const [stripe, users, excludeAdmins] = await Promise.all([
    loadStripeOverview(),
    listAppUsers(),
    readExcludeAdmins(),
  ]);
  const admins = users.filter((user) => user.admin).length;
  const visibleUsers = withoutAdmins(users, excludeAdmins);
  const foundingHolders = visibleUsers.filter((user) => user.founding);
  const charts = chartsFromStripeOverview(stripe);
  const foundingShare = buildFoundingShare(
    foundingHolders.length,
    visibleUsers.length
  );
  const drift = stripeDriftNote(
    buildStripeDrift(visibleUsers, stripe.stripeCustomerIds)
  );

  return (
    <AdminPage
      title="Payments"
      description="Read-only Stripe view. Refunds and charges stay in the Stripe dashboard. Stripe totals still include every customer."
      icon={CreditCard}
      toolbar={
        <ExcludeAdminsToggle active={excludeAdmins} hiddenCount={admins} />
      }
    >
      <StatStrip columns={4}>
        <StatTile
          label="MRR"
          value={
            <span className="flex items-center gap-2">
              {stripe.mrrLabel}
              {stripe.mode ? <StripeModeChip mode={stripe.mode} /> : null}
            </span>
          }
          sub={drift ?? "Active + trial"}
        />
        <StatTile label="Active" value={String(stripe.active)} />
        <StatTile label="Trialing" value={String(stripe.trialing)} />
        <StatTile
          label="Past due"
          value={String(stripe.pastDue)}
          sub={`${stripe.canceled} cancelled`}
        />
      </StatStrip>

      {stripe.configured ? (
        <>
          <AdminCompareStrip
            heading="Versus last week"
            items={[
              {
                label: "Paid",
                compare: charts.week.paidVolume,
                period: "week",
                formatValue: formatPenceGbp,
              },
              {
                label: "Invoices",
                compare: charts.week.paidCount,
                period: "week",
              },
              {
                label: "Subscriptions",
                compare: charts.week.newSubs,
                period: "week",
              },
              {
                label: "Refunds",
                compare: charts.week.refunds,
                period: "week",
                formatValue: formatPenceGbp,
              },
            ]}
          />
          <AdminChartGrid>
            <AdminChartCard
              title="Paid invoice volume"
              description="Stripe amount_paid per UTC day. Not accrued MRR."
            >
              <AdminBarChart
                series={charts.paidVolume30}
                label="Paid invoice volume"
                tone="profit"
                formatValue={formatPenceGbp}
              />
            </AdminChartCard>
            <AdminChartCard
              title="Stripe status"
              description="Every subscription Stripe still lists, including cancelled."
            >
              <AdminDonutChart slices={charts.statusShare} label="Stripe status" />
            </AdminChartCard>
          </AdminChartGrid>
          <AdminChartGrid>
            <AdminChartCard
              title="Subscriptions started"
              description="Day the Stripe subscription was created, including later cancels."
            >
              <AdminBarChart
                series={charts.newSubs30}
                label="Subscriptions started"
              />
            </AdminChartCard>
            <AdminChartCard
              title="Refund volume"
              description="Stripe refund amounts per UTC day."
            >
              <AdminBarChart
                series={charts.refundVolume30}
                label="Refund volume"
                tone="destructive"
                formatValue={formatPenceGbp}
              />
            </AdminChartCard>
          </AdminChartGrid>
          <AdminChartGrid>
            <AdminChartCard
              title="Founding-rate share"
              description="Accounts marked founding in app_users, not a Stripe coupon count."
            >
              <AdminDonutChart
                slices={foundingShare}
                label="Founding-rate share"
              />
            </AdminChartCard>
            <AdminChartCard
              title="Paid invoices"
              description="How many invoices Stripe marked paid each UTC day."
            >
              <AdminBarChart
                series={charts.paidCount30}
                label="Paid invoices"
                tone="brand"
              />
            </AdminChartCard>
          </AdminChartGrid>
        </>
      ) : null}

      {stripe.configured && stripe.failed.length > 0 ? (
        <AdminSection
          title="Needs attention"
          description="Past due, open or uncollectible. Refunds and charges stay in the Stripe dashboard."
        >
          <AdminTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeaderCell}>Email</TableHead>
                  <TableHead className={tableHeaderCell}>Amount</TableHead>
                  <TableHead className={tableHeaderCell}>Status</TableHead>
                  <TableHead className={tableHeaderCell}>When</TableHead>
                  <TableHead className={cn(tableHeaderCell, "text-right")}>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripe.failed.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className={tableBodyCell}>{invoice.email ?? "—"}</TableCell>
                    <TableCell className={tableBodyCell}>{invoice.amountLabel}</TableCell>
                    <TableCell className={cn(tableBodyCell, "capitalize text-destructive")}>
                      {invoice.status}
                    </TableCell>
                    <TableCell className={tableBodyCell}>{formatAdminDateTime(invoice.createdAt)}</TableCell>
                    <TableCell className={cn(tableBodyCell, "text-right")}>
                      <a
                        href={stripeInvoiceUrl(invoice.id, stripe.mode)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary-text hover:underline"
                      >
                        Open
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableFrame>
        </AdminSection>
      ) : null}

      <AdminSection title="Founding-rate holders">
        {foundingHolders.length === 0 ? (
          <EmptyState
            compact
            icon={CreditCard}
            title="No founding-rate accounts yet"
            description="Founding-rate holders appear here after they subscribe."
          />
        ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>Signed up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {foundingHolders.map((user) => (
                <TableRow key={user.clerkUserId}>
                  <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>
                    {user.email ?? user.clerkUserId}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "capitalize")}>{user.plan}</TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDateTime(user.createdAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        )}
      </AdminSection>

      {!stripe.configured ? (
        <EmptyState
          icon={CreditCard}
          title="Stripe is not connected"
          description={stripe.message ?? "Set STRIPE_SECRET_KEY to load invoices and MRR."}
        />
      ) : (
        <>
          <AdminSection title="Recent invoices">
            {stripe.invoices.length === 0 ? (
              <EmptyState
                compact
                icon={CreditCard}
                title="No invoices yet"
                description="Recent invoices from Stripe will show here."
              />
            ) : (
            <AdminTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeaderCell}>Email</TableHead>
                  <TableHead className={tableHeaderCell}>Amount</TableHead>
                  <TableHead className={tableHeaderCell}>Status</TableHead>
                  <TableHead className={tableHeaderCell}>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripe.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className={tableBodyCell}>{invoice.email ?? "—"}</TableCell>
                    <TableCell className={tableBodyCell}>{invoice.amountLabel}</TableCell>
                    <TableCell className={cn(tableBodyCell, "capitalize")}>{invoice.status}</TableCell>
                    <TableCell className={tableBodyCell}>{formatAdminDateTime(invoice.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </AdminTableFrame>
            )}
          </AdminSection>
          <AdminSection title="Refunds">
            {stripe.refunds.length === 0 ? (
              <EmptyState
                compact
                icon={CreditCard}
                title="No recent refunds"
                description="Refunds stay in Stripe. This list is read-only."
              />
            ) : (
            <AdminTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeaderCell}>Amount</TableHead>
                  <TableHead className={tableHeaderCell}>Status</TableHead>
                  <TableHead className={tableHeaderCell}>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {stripe.refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className={tableBodyCell}>{refund.amountLabel}</TableCell>
                      <TableCell className={cn(tableBodyCell, "capitalize")}>{refund.status}</TableCell>
                      <TableCell className={tableBodyCell}>{formatAdminDateTime(refund.createdAt)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </AdminTableFrame>
            )}
          </AdminSection>
        </>
      )}
    </AdminPage>
  );
}
