"use client";

import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAddBalance } from "@/components/add-balance-provider";
import { MoneyFlow } from "@/components/money-flow";
import { api, useAppState } from "@/hooks/use-app-state";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { PageGrid, PageMain, PageShell, PageSide } from "@/components/page-shell";
import { PageHeaderActions, pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { cn } from "@/lib/utils";
import { Plus, Wallet } from "lucide-react";

export default function BalancesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <BalancesContent />
    </Suspense>
  );
}

function BalancesContent() {
  const { openAddBalance } = useAddBalance();
  const { state, refresh } = useAppState(3000);

  const balances = state?.balances;
  const accounts = balances?.accounts ?? [];
  const bets = state?.bets ?? [];

  const profitByBookie = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bets) {
      if (b.actualProfit == null || b.status === "void" || !b.bookmaker) continue;
      const key = b.bookmaker;
      map.set(key, (map.get(key) ?? 0) + b.actualProfit);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [bets]);

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Balances</h1>
          <p className="text-sm text-muted-foreground">
            Track funds across bookies and exchanges. Stakes and settlements update automatically
            when bets are linked to accounts.
          </p>
        </div>
        <PageHeaderActions>
          <Button variant="outline" {...pageSecondaryButtonProps} asChild>
            <a href="/api/export/csv?type=balances" download>
              Export ledger
            </a>
          </Button>
          <Button {...pagePrimaryButtonProps} onClick={openAddBalance}>
            <Plus className="size-4" /> Add balance
          </Button>
        </PageHeaderActions>
      </div>

      <PageGrid>
        <PageMain>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle section>Accounts</CardTitle>
            <CardDescription>
              Name must match the bookie picker in Add bet for auto ledger. Exchanges link via
              Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Free bets</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No accounts — use Add balance → New account to create one.
                    </TableCell>
                  </TableRow>
                )}
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {a.type === "bookie" ? (
                          <span
                            className="inline-block size-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: bookieBrandColor(a.name, a.brandColor),
                            }}
                          />
                        ) : (
                          <Wallet className="size-4 text-muted-foreground" />
                        )}
                        {a.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.type === "bookie" ? "secondary" : "outline"}>
                        {a.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        a.balance < 0 && "text-negative"
                      )}
                    >
                      <MoneyFlow value={a.balance} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                      {a.type === "bookie" ? (
                        <MoneyFlow value={a.freeBets ?? 0} />
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ArchiveAccountButton
                        accountName={a.name}
                        onConfirm={async () => {
                          try {
                            await api(`/api/accounts/${a.id}`, { method: "DELETE" });
                            toast.success("Account archived");
                            refresh();
                          } catch (e) {
                            toast.error("Could not remove", { description: String(e) });
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </PageMain>

        <PageSide>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle section>Settled P&amp;L by bookie</CardTitle>
            <CardDescription>From profit tracker — for reconciliation</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {profitByBookie.length === 0 && (
              <p className="text-sm text-muted-foreground">No settled bookie bets yet.</p>
            )}
            {profitByBookie.map(([name, profit]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span>{name}</span>
                <MoneyFlow value={profit} signColor signDisplay className="font-medium" />
              </div>
            ))}
          </CardContent>
        </Card>
        </PageSide>
      </PageGrid>

    </PageShell>
  );
}

function ArchiveAccountButton({
  accountName,
  onConfirm,
}: {
  accountName: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive account?</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive <span className="font-medium text-foreground">{accountName}</span>?
              It will be hidden from active accounts but ledger history is kept.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
