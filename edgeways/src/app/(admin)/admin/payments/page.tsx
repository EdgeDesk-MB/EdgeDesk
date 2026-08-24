import { CreditCard } from "lucide-react";
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
import { formatAdminDateTime } from "@/lib/admin/format";
import { loadStripeOverview } from "@/lib/admin/stripe-overview";
import { listAppUsers } from "@/lib/services/app-users";
import { sectionTitle, tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminPaymentsPage() {
  const [stripe, users] = await Promise.all([
    loadStripeOverview(),
    listAppUsers(),
  ]);
  const foundingHolders = users.filter((user) => user.founding);

  return (
    <AdminPage
      title="Payments"
      description="Read-only Stripe view. Refunds and charges stay in the Stripe dashboard."
      icon={CreditCard}
    >
      <StatStrip columns={4}>
        <StatTile label="MRR" value={stripe.mrrLabel} sub="Active + trial" />
        <StatTile label="Active" value={String(stripe.active)} />
        <StatTile label="Trialing" value={String(stripe.trialing)} />
        <StatTile
          label="Past due"
          value={String(stripe.pastDue)}
          sub={`${stripe.canceled} cancelled`}
        />
      </StatStrip>

      <section>
        <h2 className={sectionTitle}>Founding-rate holders</h2>
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
      </section>

      {!stripe.configured ? (
        <EmptyState
          icon={CreditCard}
          title="Stripe is not connected"
          description={stripe.message ?? "Set STRIPE_SECRET_KEY to load invoices and MRR."}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className={sectionTitle}>Recent invoices</h2>
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
          </section>
          <section>
            <h2 className={sectionTitle}>Failed / open</h2>
            {stripe.failed.length === 0 ? (
              <EmptyState
                compact
                icon={CreditCard}
                title="No open or failed invoices"
                description="Nothing open or failed on the last Stripe page."
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
                  {stripe.failed.map((invoice) => (
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
          </section>
          <section>
            <h2 className={sectionTitle}>Refunds</h2>
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
          </section>
        </div>
      )}
    </AdminPage>
  );
}
