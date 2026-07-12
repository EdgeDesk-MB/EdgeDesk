"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAddBalance } from "@/components/add-balance-provider";
import { TransferFundsDialog } from "@/components/accounts/transfer-funds-dialog";
import { ManageVenuesDialog } from "@/components/accounts/venue-admin-panel";
import { MoneyFlow } from "@/components/money-flow";
import { api, useAppState } from "@/hooks/use-app-state";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import {
  PageHeaderActions,
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import type { AccountBalance } from "@/lib/services/balances.types";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, Building2, Check, Pencil, Plus, Trash2, Wallet } from "lucide-react";

type TxRow = {
  id: number;
  amount: number;
  category: string;
  note: string | null;
  createdAt: number;
  pending?: number;
};

type PendingTx = TxRow & { accountName: string };

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <AccountsContent />
    </Suspense>
  );
}

function AccountsContent() {
  const { openAddBalance } = useAddBalance();
  const { state, refresh } = useAppState(3000);

  const balances = state?.balances;
  const accounts = balances?.accounts ?? [];
  const bets = state?.bets ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [manageVenuesOpen, setManageVenuesOpen] = useState(false);
  const [pending, setPending] = useState<PendingTx[]>([]);

  const banks = useMemo(() => accounts.filter((a) => a.type === "bank"), [accounts]);
  const venues = useMemo(
    () => accounts.filter((a) => a.type === "bookie" || a.type === "exchange"),
    [accounts]
  );

  const profitByBookie = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bets) {
      if (b.actualProfit == null || b.status === "void" || !b.bookmaker) continue;
      const key = b.bookmaker.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + b.actualProfit);
    }
    return map;
  }, [bets]);

  function profitForAccount(name: string): number | null {
    const key = name.trim().toLowerCase();
    if (!profitByBookie.has(key)) return null;
    return profitByBookie.get(key) ?? 0;
  }

  const selected = accounts.find((a) => a.id === selectedId) ?? null;
  const bankNameById = useMemo(
    () => new Map(banks.map((b) => [b.id, b.name] as const)),
    [banks]
  );

  useEffect(() => {
    api<{ pending: PendingTx[] }>("/api/accounts/pending")
      .then((r) => setPending(r.pending ?? []))
      .catch(() => setPending([]));
  }, [state?.balances?.total, state?.balances?.pendingBankCredits]);

  async function confirmPending(txId: number) {
    try {
      await api("/api/accounts/pending", {
        method: "POST",
        json: { transactionId: txId },
      });
      toast.success("Bank credit confirmed");
      refresh();
    } catch (e) {
      toast.error("Could not confirm", { description: String(e) });
    }
  }

  return (
    <PageShell>
      <PageHeader
        helpId="accounts"
        title="Accounts"
        description="Banks, bookies and exchanges. First bet creates a bookie wallet; transfer from a bank to fund it."
        action={
          <PageHeaderActions>
            <Button variant="outline" {...pageSecondaryButtonProps} asChild>
              <a href="/api/export/csv?type=balances" download>
                Export ledger
              </a>
            </Button>
            <Button
              variant="outline"
              {...pageSecondaryButtonProps}
              onClick={() => setAddBankOpen(true)}
            >
              <Building2 className="size-4" /> Add bank
            </Button>
            <Button
              variant="outline"
              {...pageSecondaryButtonProps}
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight className="size-4" /> Transfer
            </Button>
            <Button {...pagePrimaryButtonProps} onClick={openAddBalance}>
              <Plus className="size-4" /> Adjust balance
            </Button>
          </PageHeaderActions>
        }
      />

      {pending.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle section>Pending bank credits</CardTitle>
            <CardDescription>
              Withdrawals waiting for statement confirmation - confirm when the money lands.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pending.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-500/20 bg-card px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{tx.accountName}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {tx.note || "Transfer"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <MoneyFlow value={tx.amount} signDisplay className="font-semibold" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => confirmPending(tx.id)}
                  >
                    <Check className="size-3" /> Confirm
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
          {banks.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle section>Banks</CardTitle>
                <CardDescription>
                  Funding source for deposits. Total{" "}
                  <MoneyFlow
                    value={balances?.banks ?? 0}
                    className="inline font-semibold"
                  />
                  {(balances?.pendingBankCredits ?? 0) > 0 ? (
                    <>
                      {" · "}
                      <span className="text-amber-700 dark:text-amber-400">
                        £{(balances?.pendingBankCredits ?? 0).toFixed(2)} pending
                      </span>
                    </>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccountTable
                  rows={banks}
                  bankNameById={bankNameById}
                  profitForAccount={profitForAccount}
                  onSelect={setSelectedId}
                  onArchived={refresh}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle section>Bookies &amp; exchanges</CardTitle>
              <CardDescription>
                Name must match the bookie picker in Add bet. Open a row to rename, set funded-by,
                or view the ledger.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setManageVenuesOpen(true)}>
                  Manage
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <AccountTable
                rows={venues}
                bankNameById={bankNameById}
                profitForAccount={profitForAccount}
                onSelect={setSelectedId}
                onArchived={refresh}
                inlineTypeBadge
                empty="No bookie or exchange wallets yet - place a bet or use Adjust balance."
              />
            </CardContent>
          </Card>
      </div>

      <ManageVenuesDialog open={manageVenuesOpen} onOpenChange={setManageVenuesOpen} />

      <AccountDetailDialog
        account={selected}
        banks={banks}
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSaved={() => {
          refresh();
        }}
      />
      <TransferFundsDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={accounts}
        onSaved={refresh}
        defaultVenueId={selectedId}
      />
      <AddBankDialog
        open={addBankOpen}
        onOpenChange={setAddBankOpen}
        onSaved={refresh}
      />
    </PageShell>
  );
}

function AccountTable({
  rows,
  bankNameById,
  profitForAccount,
  onSelect,
  onArchived,
  inlineTypeBadge = false,
  empty = "No accounts yet.",
}: {
  rows: AccountBalance[];
  bankNameById: Map<number, string>;
  profitForAccount: (name: string) => number | null;
  onSelect: (id: number) => void;
  onArchived: () => void;
  /** Bookies & exchanges: type pill inline with name, no Type column */
  inlineTypeBadge?: boolean;
  empty?: string;
}) {
  const colCount = inlineTypeBadge ? 6 : 7;

  function typeBadge(type: AccountBalance["type"]) {
    return (
      <Badge
        variant={type === "bookie" ? "secondary" : type === "bank" ? "default" : "outline"}
        className="shrink-0 text-[10px] font-normal capitalize"
      >
        {type}
      </Badge>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          {!inlineTypeBadge ? <TableHead>Type</TableHead> : null}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-right">Free bets</TableHead>
          <TableHead className="text-right">Profit</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={colCount} className="py-8 text-center text-sm text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        )}
        {rows.map((a) => {
          const profit = a.type === "bookie" ? profitForAccount(a.name) : null;
          return (
          <TableRow key={a.id} className="cursor-pointer" onClick={() => onSelect(a.id)}>
            <TableCell className="font-medium">
              <span className="flex flex-wrap items-center gap-2">
                {a.type === "bookie" ? (
                  <span
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: bookieBrandColor(a.name, a.brandColor),
                    }}
                  />
                ) : a.type === "bank" ? (
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Wallet className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span>{a.name}</span>
                {inlineTypeBadge ? typeBadge(a.type) : null}
              </span>
              {a.fundedByAccountId && bankNameById.get(a.fundedByAccountId) ? (
                <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                  Funded by {bankNameById.get(a.fundedByAccountId)}
                </p>
              ) : a.notes?.trim() ? (
                <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-muted-foreground">
                  {a.notes}
                </p>
              ) : null}
              {(a.pendingIn ?? 0) > 0 ? (
                <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  +£{a.pendingIn.toFixed(2)} pending
                </p>
              ) : null}
              {(a.wrRemaining ?? 0) > 0 ? (
                <p className="mt-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                  WR £{a.wrRemaining.toFixed(2)}
                </p>
              ) : null}
            </TableCell>
            {!inlineTypeBadge ? (
              <TableCell>{typeBadge(a.type)}</TableCell>
            ) : null}
            <TableCell>
              {a.type === "bookie" ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-normal",
                    a.accessStatus === "gubbed" &&
                      "border-amber-500/40 text-amber-700 dark:text-amber-400",
                    a.accessStatus === "closed" &&
                      "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {a.accessStatus === "gubbed"
                    ? "Gubbed"
                    : a.accessStatus === "closed"
                      ? "Closed"
                      : "Available"}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
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
                <span className="font-normal text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {profit != null ? (
                <MoneyFlow value={profit} signColor signDisplay />
              ) : (
                <span className="font-normal text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => onSelect(a.id)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <ArchiveAccountButton
                  accountName={a.name}
                  onConfirm={async () => {
                    try {
                      await api(`/api/accounts/${a.id}`, { method: "DELETE" });
                      toast.success("Account archived");
                      onArchived();
                    } catch (e) {
                      toast.error("Could not remove", { description: String(e) });
                    }
                  }}
                />
              </div>
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AddBankDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [opening, setOpening] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setOpening(0);
    }
  }, [open]);

  async function save() {
    if (!name.trim()) {
      toast.error("Enter a bank name");
      return;
    }
    setSaving(true);
    try {
      await api("/api/accounts", {
        method: "POST",
        json: {
          name: name.trim(),
          type: "bank",
          openingBalance: opening,
        },
      });
      toast.success("Bank added");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Could not add bank", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add bank</DialogTitle>
          <DialogDescription>
            Your real-world funding account - use Transfer to move money to bookies.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monzo · Betting"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Opening balance (£)</Label>
            <Input
              type="number"
              step={0.01}
              value={opening || ""}
              onChange={(e) => setOpening(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            Add bank
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountDetailDialog({
  account,
  banks,
  open,
  onOpenChange,
  onSaved,
}: {
  account: AccountBalance | null;
  banks: AccountBalance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [accessStatus, setAccessStatus] = useState<"available" | "gubbed" | "closed">(
    "available"
  );
  const [fundedBy, setFundedBy] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [wrRemaining, setWrRemaining] = useState(0);
  const [wrMinOdds, setWrMinOdds] = useState("");
  const [wrType, setWrType] = useState<"stake" | "risk_win">("stake");
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [freeBetLots, setFreeBetLots] = useState<
    Array<{ id: number; remaining: number; originalAmount: number; note: string | null }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [removingLotId, setRemovingLotId] = useState<number | null>(null);

  async function loadLedger(accountId: number, opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoadingTx(true);
    try {
      const r = await api<{
        transactions: TxRow[];
        freeBetLots?: Array<{
          id: number;
          remaining: number;
          originalAmount: number;
          note: string | null;
        }>;
      }>(`/api/accounts/${accountId}`);
      setTxs(r.transactions ?? []);
      setFreeBetLots(r.freeBetLots ?? []);
    } catch {
      if (!opts?.silent) {
        setTxs([]);
        setFreeBetLots([]);
      }
    } finally {
      if (!opts?.silent) setLoadingTx(false);
    }
  }

  // Depend on account.id only - full `account` identity changes every app-state poll (~3s)
  // and was resetting the form + flashing "Loading…" in the ledger.
  useEffect(() => {
    if (!account || !open) return;
    setName(account.name);
    setAccessStatus(
      account.accessStatus === "gubbed" || account.accessStatus === "closed"
        ? account.accessStatus
        : "available"
    );
    setFundedBy(
      account.fundedByAccountId != null ? String(account.fundedByAccountId) : "none"
    );
    setNotes(account.notes ?? "");
    setWrRemaining(account.wrRemaining ?? 0);
    setWrMinOdds(
      account.wrMinOdds != null && account.wrMinOdds > 1 ? String(account.wrMinOdds) : ""
    );
    setWrType(account.wrType === "risk_win" ? "risk_win" : "stake");
    void loadLedger(account.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open + id only
  }, [account?.id, open]);

  async function removeFreeBet(lotId: number) {
    if (!account) return;
    setRemovingLotId(lotId);
    try {
      await api("/api/accounts/free-bets", {
        method: "DELETE",
        json: { lotId },
      });
      toast.success("Free bet removed");
      await loadLedger(account.id, { silent: true });
      onSaved();
    } catch (e) {
      toast.error("Could not remove free bet", { description: String(e) });
    } finally {
      setRemovingLotId(null);
    }
  }

  async function save() {
    if (!account) return;
    setSaving(true);
    try {
      const minOddsNum = wrMinOdds.trim() ? Number(wrMinOdds) : null;
      const res = await api<{
        account: AccountBalance;
        rename?: { betsUpdated: number; offersUpdated: number; prefsUpdated: number };
      }>(`/api/accounts/${account.id}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          accessStatus: account.type === "bookie" ? accessStatus : undefined,
          notes: notes.trim() || null,
          fundedByAccountId:
            account.type === "bookie" || account.type === "exchange"
              ? fundedBy === "none"
                ? null
                : Number(fundedBy)
              : undefined,
          ...(account.type === "bookie"
            ? {
                wrRemaining,
                wrMinOdds: minOddsNum != null && minOddsNum > 1 ? minOddsNum : null,
                wrType,
              }
            : {}),
        },
      });
      const r = res.rename;
      if (r && (r.betsUpdated || r.offersUpdated || r.prefsUpdated)) {
        toast.success("Account updated", {
          description: `Renamed across ${r.betsUpdated} bet${r.betsUpdated === 1 ? "" : "s"}, ${r.offersUpdated} offer${r.offersUpdated === 1 ? "" : "s"}.`,
        });
      } else {
        toast.success("Account updated");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (!account) return null;

  const freeBetsShown =
    account.type === "bookie"
      ? loadingTx
        ? (account.freeBets ?? 0)
        : freeBetLots.reduce((sum, lot) => sum + lot.remaining, 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2">
            {account.type === "bookie" ? (
              <span
                className="inline-block size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: bookieBrandColor(account.name, account.brandColor),
                }}
              />
            ) : account.type === "bank" ? (
              <Building2 className="size-4 text-muted-foreground" />
            ) : (
              <Wallet className="size-4 text-muted-foreground" />
            )}
            {account.name}
          </DialogTitle>
          <DialogDescription>
            Cash <MoneyFlow value={account.balance} className="inline font-semibold" />
            {account.type === "bookie" ? (
              <>
                {" · "}
                Free bets{" "}
                <MoneyFlow
                  value={freeBetsShown}
                  className="inline font-semibold text-violet-600 dark:text-violet-400"
                />
                {(account.wrRemaining ?? 0) > 0 ? (
                  <>
                    {" · "}
                    <span className="text-sky-700 dark:text-sky-400">
                      WR £{account.wrRemaining.toFixed(2)} left
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
            {(account.pendingIn ?? 0) > 0 ? (
              <>
                {" · "}
                <span className="text-amber-700 dark:text-amber-400">
                  £{account.pendingIn.toFixed(2)} pending
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="app-scroll-nested min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {account.type === "bookie" ? (
              <p className="text-[10px] text-muted-foreground">
                Renaming updates bets, offers, and remembered prefs that used this name.
              </p>
            ) : null}
          </div>

          {account.type === "bookie" ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Access status</Label>
              <Select
                value={accessStatus}
                onValueChange={(v) => setAccessStatus(v as typeof accessStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="gubbed">Gubbed / limited</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {(account.type === "bookie" || account.type === "exchange") &&
          banks.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Funded by</Label>
              <Select value={fundedBy} onValueChange={setFundedBy}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {account.type === "bookie" ? (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
                Wagering requirement
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">Remaining (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={wrRemaining || ""}
                    onChange={(e) => setWrRemaining(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px] text-muted-foreground">Min odds</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.01}
                    value={wrMinOdds}
                    onChange={(e) => setWrMinOdds(e.target.value)}
                    placeholder="Any"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <Label className="text-[10px] text-muted-foreground">Counts as</Label>
                <Select
                  value={wrType}
                  onValueChange={(v) => setWrType(v as typeof wrType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stake">Stake (full back stake)</SelectItem>
                    <SelectItem value="risk_win">Risk/win (min of stake &amp; winnings)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Cash qualifying bets auto-reduce WR when odds meet the minimum.
              </p>
            </div>
          ) : null}

          {account.type === "bookie" && freeBetLots.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Free bets
              </p>
              <ul className="space-y-1.5 text-sm">
                {freeBetLots.map((lot) => (
                  <li
                    key={lot.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {lot.note
                        ?.replace(/^Free bet promo - /, "")
                        .replace(/\[\[lot:\d+\]\]\s*/g, "")
                        .slice(0, 48) || "Free bet"}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <MoneyFlow
                        value={lot.remaining}
                        className="font-semibold text-violet-700 dark:text-violet-300"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={removingLotId === lot.id}
                        aria-label="Remove free bet"
                        title="Remove free bet"
                        onClick={() => void removeFreeBet(lot.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="min-h-[4rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent ledger
            </p>
            {loadingTx ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : txs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {txs.slice(0, 25).map((tx) => (
                  <li
                    key={tx.id}
                    className="flex min-w-0 items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block text-[11px] font-medium uppercase text-muted-foreground">
                        {tx.category.replace(/_/g, " ")}
                        {tx.pending ? " · pending" : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {tx.note || "-"}
                      </span>
                    </span>
                    <MoneyFlow
                      value={tx.amount}
                      signColor
                      signDisplay
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        tx.pending && "text-amber-700 dark:text-amber-400"
                      )}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
              Are you sure you want to archive{" "}
              <span className="font-medium text-foreground">{accountName}</span>? It will be hidden
              from active accounts but ledger history is kept.
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
