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
import { useExchanges } from "@/hooks/use-exchanges";
import {
  computeAccountBreakdown,
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
  const { exchanges } = useExchanges();
  const bets = state?.bets ?? [];

  const monthly = useMemo(() => computeMonthlyBreakdown(bets), [bets]);
  const accounts = useMemo(
    () => computeAccountBreakdown(bets, exchanges),
    [bets, exchanges]
  );

  const plain = variant === "plain" || embedded;

  if (monthly.length === 0 && accounts.length === 0) {
    if (compact) return null;
    const emptyBody = (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No settled bets yet.{" "}
        <Link href="/tracker" className="font-medium text-primary underline-offset-2 hover:underline">
          Log your first bet
        </Link>
        .
      </div>
    );
    if (plain) return emptyBody;
    return (
      <Card>
        <SectionHeader
          title="Monthly P&L"
          description="Settle bets to see profit by month and bookmaker."
        />
        <CardContent>{emptyBody}</CardContent>
      </Card>
    );
  }

  const monthTable = (
    <div>
      <div className={cn("rounded-t-md px-3 py-2", plain ? selectionSubtle : undefined)}>
        <h3 className={sectionTitle}>By month</h3>
      </div>
      <div className="overflow-x-auto rounded-b-lg border border-border/80 border-t-0">
        <Table>
          <TableHeader>
            <TableRow className={cn("hover:bg-transparent", plain && selectionSubtle)}>
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
    <div>
      <div className={cn("rounded-t-md px-3 py-2", plain ? selectionSubtle : undefined)}>
        <h3 className={sectionTitle}>By account</h3>
      </div>
      <div className="overflow-x-auto rounded-b-lg border border-border/80 border-t-0">
        <Table>
          <TableHeader>
            <TableRow className={cn("hover:bg-transparent", plain && selectionSubtle)}>
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

  const body = (
    <div className={plain ? "flex flex-col gap-4" : "grid gap-4 lg:grid-cols-2"}>
      {monthTable}
      {accountTable}
    </div>
  );

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle section>Monthly P&L</CardTitle>
              <CardDescription compact>Settled profit by month and account.</CardDescription>
            </div>
            <Link
              href="/tracker?tab=pnl"
              className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
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
        title="Monthly P&L"
        description="Settled profit rolled up by calendar month and by bookmaker / exchange."
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
