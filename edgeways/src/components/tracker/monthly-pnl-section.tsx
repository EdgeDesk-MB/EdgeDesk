"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoneyFlow } from "@/components/money-flow";
import { SectionHeader } from "@/components/page-shell";
import { useAppState } from "@/hooks/use-app-state";
import {
  computeAccountBreakdown,
  computeMethodBreakdown,
  computeMonthlyBreakdown,
} from "@/lib/pnl/monthly-breakdown";
import { tableBodyCell, tableHeaderCell, sectionTitle, selectionSubtle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

export function MonthlyPnlSection({
  compact = false,
  embedded = false,
  variant = "card",
}: {
  compact?: boolean;
  /** @deprecated use variant="plain" */
  embedded?: boolean;
  variant?: "card" | "plain";
}) {
  const { state } = useAppState();
  const bets = state?.bets ?? [];
  const casinoSettlements = state?.casinoSettlements ?? [];

  const monthly = useMemo(
    () => computeMonthlyBreakdown(bets, casinoSettlements),
    [bets, casinoSettlements]
  );
  const accounts = useMemo(
    () => computeAccountBreakdown(bets, casinoSettlements),
    [bets, casinoSettlements]
  );
  const methods = useMemo(
    () => computeMethodBreakdown(bets, casinoSettlements),
    [bets, casinoSettlements]
  );

  const plain = variant === "plain" || embedded;

  if (monthly.length === 0 && accounts.length === 0 && methods.length === 0) {
    if (compact) return null;
    const emptyBody = (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No settled bets yet.{" "}
        <Link href="/tracker" className="font-medium text-primary-text underline-offset-2 hover:underline">
          Log your first bet
        </Link>
        .
      </div>
    );
    if (plain) return emptyBody;
    return (
      <Card>
        <SectionHeader
          title="P&L Breakdown"
          description="Settle bets to see profit by month, account and method."
        />
        <CardContent>{emptyBody}</CardContent>
      </Card>
    );
  }

  const tableShell = "overflow-hidden rounded-lg border border-border/80";
  const headerRow = cn("hover:bg-transparent", plain && selectionSubtle);

  const monthTable = (
    <div className="flex flex-col gap-2">
      <h3 className={sectionTitle}>By month</h3>
      <div className={tableShell}>
        <Table>
          <TableHeader>
            <TableRow className={headerRow}>
              <TableHead className={tableHeaderCell}>Month</TableHead>
              <TableHead className={tableHeaderCell}>Bets</TableHead>
              <TableHead className={cn(tableHeaderCell, "text-right")}>Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map((row) => (
              <TableRow key={row.key} className="hover:bg-selection-subtle">
                <TableCell className={cn(tableBodyCell, "text-sm font-medium")}>
                  {row.label}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "tabular-nums text-muted-foreground")}>
                  {row.betCount}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "text-right tabular-nums")}>
                  <MoneyFlow value={row.profit} signColor />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const accountTable = (
    <div className="flex flex-col gap-2">
      <h3 className={sectionTitle}>By account</h3>
      <div className={tableShell}>
        <Table>
          <TableHeader>
            <TableRow className={headerRow}>
              <TableHead className={tableHeaderCell}>Account</TableHead>
              <TableHead className={tableHeaderCell}>Bets</TableHead>
              <TableHead className={cn(tableHeaderCell, "text-right")}>Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((row) => (
              <TableRow key={row.name} className="hover:bg-selection-subtle">
                <TableCell className={tableBodyCell}>
                  <span className="text-sm font-medium">{row.name}</span>
                  <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                    {row.kind}
                  </span>
                </TableCell>
                <TableCell className={cn(tableBodyCell, "tabular-nums text-muted-foreground")}>
                  {row.betCount}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "text-right tabular-nums")}>
                  <MoneyFlow value={row.profit} signColor />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const methodTable =
    methods.length > 0 ? (
      <div className="flex flex-col gap-2">
        <h3 className={sectionTitle}>By method</h3>
        <div className={tableShell}>
          <Table>
            <TableHeader>
              <TableRow className={headerRow}>
                <TableHead className={tableHeaderCell}>Method</TableHead>
                <TableHead className={tableHeaderCell}>Bets</TableHead>
                <TableHead className={cn(tableHeaderCell, "text-right")}>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((row) => (
                <TableRow key={row.key} className="hover:bg-selection-subtle">
                  <TableCell className={cn(tableBodyCell, "text-sm font-medium")}>
                    {row.label}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "tabular-nums text-muted-foreground")}>
                    {row.betCount}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "text-right tabular-nums")}>
                    <MoneyFlow value={row.profit} signColor />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    ) : null;

  const body = (
    <div className={plain ? "flex flex-col gap-4" : "grid gap-4 lg:grid-cols-2"}>
      {monthTable}
      {accountTable}
      {methodTable}
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle section>P&L Breakdown</CardTitle>
              <CardDescription compact>Settled profit by month, account and method.</CardDescription>
            </div>
            <Link
              href="/tracker?tab=pnl"
              className="shrink-0 text-xs font-medium text-primary-text underline-offset-2 hover:underline"
            >
              Details →
            </Link>
          </div>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    );
  }

  if (embedded || plain) {
    return body;
  }

  return (
    <Card>
      <SectionHeader
        title="P&L Breakdown"
        description="Settled profit rolled up by calendar month, bookie, and method."
        action={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href="/api/export/csv?type=monthly" download>
              <Download className="size-3.5" /> Export
            </a>
          </Button>
        }
      />
      <CardContent className="pt-4">{body}</CardContent>
    </Card>
  );
}
