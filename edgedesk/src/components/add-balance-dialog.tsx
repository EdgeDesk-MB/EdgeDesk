"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import type { AccountBalance } from "@/lib/services/balances.types";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { BookieNamePicker, EXCHANGE_CUSTOM } from "@/components/bookie-name-picker";
import { formatGbp, roundMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

type FundKind = "cash" | "free_bet";

interface TopUpRow {
  accountId: number;
  amount: number;
  note: string;
  fundKind: FundKind;
}

export function AddBalanceDialog({
  open,
  onOpenChange,
  accounts,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountBalance[];
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Gate on open: the form renders DialogContent itself, so it must be
          unmounted explicitly for state to reset between opens. */}
      {open ? (
        <AddBalanceForm accounts={accounts} onOpenChange={onOpenChange} onSaved={onSaved} />
      ) : null}
    </Dialog>
  );
}

function seedRow(account: AccountBalance | undefined, mode: string): TopUpRow[] {
  if (!account) return [];
  return [
    {
      accountId: account.id,
      amount: mode === "adjustment" ? roundMoney(account.balance) : 0,
      note: "",
      fundKind: "cash",
    },
  ];
}

/**
 * Form state lives inside DialogContent, which Radix unmounts on close, so
 * every open starts fresh with no reset effects. The first row is derived at
 * render while `rows` is empty, covering accounts that load mid-open.
 */
function AddBalanceForm({
  accounts,
  onOpenChange,
  onSaved,
}: {
  accounts: AccountBalance[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { exchanges } = useExchanges();
  const [mode, setMode] = useState<"top_up" | "withdrawal" | "adjustment">("top_up");
  const [rows, setRows] = useState<TopUpRow[]>(() => seedRow(accounts[0], "top_up"));
  const [affectPnl, setAffectPnl] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newType, setNewType] = useState<"bookie" | "exchange" | "bank">("bookie");
  const [newName, setNewName] = useState("");
  const [newExchangeId, setNewExchangeId] = useState<string>("");
  const [exchangeCustom, setExchangeCustom] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);

  const effectiveRows = rows.length > 0 ? rows : seedRow(accounts[0], mode);

  /** Mode change reshapes every row - amounts reset (or mirror balances). */
  function changeMode(next: typeof mode) {
    setMode(next);
    setRows(
      effectiveRows.map((row) => {
        const account = accounts.find((a) => a.id === row.accountId) ?? accounts[0];
        return {
          ...row,
          amount: next === "adjustment" ? roundMoney(account?.balance ?? 0) : 0,
          fundKind: account?.type === "bookie" ? row.fundKind : "cash",
        };
      })
    );
  }

  const signedAmount = (amount: number) =>
    mode === "withdrawal" ? -Math.abs(amount) : amount;

  /** In adjustment mode, row.amount is the target balance - return ledger delta. */
  function rowLedgerAmount(row: TopUpRow): number {
    if (mode === "adjustment") {
      const account = accounts.find((a) => a.id === row.accountId);
      return roundMoney(row.amount - (account?.balance ?? 0));
    }
    return roundMoney(signedAmount(row.amount));
  }

  function categoryForRow(row: TopUpRow): "top_up" | "withdrawal" | "adjustment" | "free_bet" {
    if (mode === "top_up" && row.fundKind === "free_bet") return "free_bet";
    return mode;
  }

  async function save() {
    const entries = effectiveRows
      .filter((r) => rowLedgerAmount(r) !== 0)
      .map((r) => {
        const account = accounts.find((a) => a.id === r.accountId);
        if (mode === "top_up" && r.fundKind === "free_bet" && account?.type !== "bookie") {
          return null;
        }
        const amount = rowLedgerAmount(r);
        return {
          accountId: r.accountId,
          amount,
          category: categoryForRow(r),
          note:
            r.note.trim() ||
            (categoryForRow(r) === "free_bet"
              ? "Manual free bet top-up"
              : categoryForRow(r) === "adjustment"
                ? `Balance set to ${formatGbp(r.amount)}`
                : undefined),
          ...(mode === "adjustment" && affectPnl ? { affectPnl: true } : {}),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e != null);

    if (entries.length === 0) {
      toast.error(
        mode === "adjustment"
          ? "Enter a new balance that differs from the current amount"
          : "Enter at least one amount"
      );
      return;
    }
    if (entries.length < effectiveRows.filter((r) => rowLedgerAmount(r) !== 0).length) {
      toast.error("Free bets can only be added to bookie accounts");
      return;
    }

    setSaving(true);
    try {
      await api("/api/balances", { method: "POST", json: { entries } });
      toast.success("Balances updated");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function createAccount() {
    if (!newName.trim()) {
      toast.error("Enter an account name");
      return;
    }
    if (newType === "exchange" && !exchangeCustom && !newExchangeId) {
      toast.error("Select an exchange or add a custom name");
      return;
    }
    setSaving(true);
    try {
      await api("/api/accounts", {
        method: "POST",
        json: {
          name: newName.trim(),
          type: newType,
          exchangeId:
            newType === "exchange" && !exchangeCustom && newExchangeId
              ? Number(newExchangeId)
              : undefined,
          brandColor:
            newType === "bookie" ? bookieBrandColor(newName.trim()) : undefined,
          openingBalance,
        },
      });
      toast.success("Account added");
      setShowAddAccount(false);
      setNewName("");
      setNewExchangeId("");
      setExchangeCustom(false);
      setOpeningBalance(0);
      onSaved();
    } catch (e) {
      toast.error("Could not add account", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  // Cheap reductions - plain derivation keeps them exact every render.
  const totalDelta = roundMoney(effectiveRows.reduce((s, r) => s + rowLedgerAmount(r), 0));

  const totalFreeBets =
    mode === "top_up"
      ? effectiveRows
          .filter((r) => r.fundKind === "free_bet")
          .reduce((s, r) => s + Math.abs(r.amount), 0)
      : 0;

  const totalCash = effectiveRows
    .filter((r) => mode !== "top_up" || r.fundKind === "cash")
    .reduce((s, r) => s + signedAmount(r.amount), 0);

  return (
    <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="border-b px-6 pb-4 pt-7">
          <DialogTitle className="text-[25px] font-extrabold tracking-tight">
            Adjust balance
          </DialogTitle>
          <DialogDescription>
            Top up cash balance or free bets, withdraw, or adjust across your bookie and exchange
            accounts. Free bets from AI triggers are credited automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="app-scroll-nested flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-6">
          <Tabs value={mode} onValueChange={(v) => changeMode(v as typeof mode)}>
            <TabsList>
              <TabsTrigger value="top_up">Top up</TabsTrigger>
              <TabsTrigger value="withdrawal">Withdraw</TabsTrigger>
              <TabsTrigger value="adjustment">Adjust</TabsTrigger>
            </TabsList>
          </Tabs>

          {accounts.length === 0 && !showAddAccount && (
            <p className="text-sm text-muted-foreground">
              No accounts yet - add a bookie or exchange wallet first.
            </p>
          )}

          {effectiveRows.map((row, i) => {
            const account = accounts.find((a) => a.id === row.accountId);
            const canFreeBet = mode === "top_up" && account?.type === "bookie";

            return (
              <div
                key={i}
                className={cn(
                  "grid items-end gap-2",
                  mode === "top_up"
                    ? "grid-cols-[1fr_100px_120px_1fr_auto]"
                    : "grid-cols-[1fr_120px_1fr_auto]"
                )}
              >
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Account</Label>
                  <Select
                    value={String(row.accountId)}
                    onValueChange={(v) =>
                      setRows(
                        effectiveRows.map((r, j) => {
                          if (j !== i) return r;
                          const nextId = Number(v);
                          const nextAccount = accounts.find((a) => a.id === nextId);
                          return {
                            ...r,
                            accountId: nextId,
                            fundKind:
                              nextAccount?.type === "bookie" ? r.fundKind : "cash",
                            amount:
                              mode === "adjustment"
                                ? roundMoney(nextAccount?.balance ?? 0)
                                : r.amount,
                          };
                        })
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}{" "}
                          <span className="text-muted-foreground">
                            ({a.type}) · {formatGbp(a.balance)}
                            {a.type === "bookie" && (a.freeBets ?? 0) > 0 && (
                              <> · FB {formatGbp(a.freeBets ?? 0)}</>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {mode === "top_up" && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select
                      value={row.fundKind}
                      onValueChange={(v) =>
                        setRows(
                          effectiveRows.map((r, j) =>
                            j === i ? { ...r, fundKind: v as FundKind } : r
                          )
                        )
                      }
                      disabled={!canFreeBet}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="free_bet" disabled={account?.type !== "bookie"}>
                          Free bet
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {mode === "adjustment" ? "New balance" : "Amount"}
                  </Label>
                  <Input
                    type="number"
                    step={0.01}
                    min={mode === "adjustment" ? undefined : 0}
                    prefix=""
                    value={row.amount || ""}
                    onChange={(e) =>
                      setRows(
                        effectiveRows.map((r, j) =>
                          j === i
                            ? { ...r, amount: roundMoney(parseFloat(e.target.value) || 0) }
                            : r
                        )
                      )
                    }
                    placeholder={
                      mode === "adjustment" && account
                        ? formatGbp(account.balance).slice(1)
                        : "0.00"
                    }
                    className="tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Note</Label>
                  <Input
                    value={row.note}
                    onChange={(e) =>
                      setRows(
                        effectiveRows.map((r, j) => (j === i ? { ...r, note: e.target.value } : r))
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  disabled={effectiveRows.length <= 1}
                  onClick={() => setRows(effectiveRows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}

          {mode === "adjustment" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded accent-primary"
                checked={affectPnl}
                onChange={(e) => setAffectPnl(e.target.checked)}
              />
              <span>Include in P&amp;L</span>
              <span className="text-xs text-muted-foreground">
                — records this correction in your profit &amp; loss history
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={accounts.length === 0}
              onClick={() =>
                setRows([
                  ...effectiveRows,
                  {
                    accountId: accounts[0]?.id ?? 0,
                    amount: mode === "adjustment" ? (accounts[0]?.balance ?? 0) : 0,
                    note: "",
                    fundKind: "cash",
                  },
                ])
              }
            >
              <Plus className="size-3.5" /> Add row
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddAccount((s) => !s)}
            >
              {showAddAccount ? "Cancel new account" : "New account"}
            </Button>
          </div>

          {showAddAccount && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold">Add wallet</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bookie">Bookie</SelectItem>
                      <SelectItem value="exchange">Exchange</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newType === "bookie" ? (
                  <BookieNamePicker
                    value={newName}
                    onChange={setNewName}
                    className="sm:col-span-1"
                  />
                ) : newType === "bank" ? (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Bank name</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Monzo · Betting"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Exchange</Label>
                    <Select
                      value={exchangeCustom ? EXCHANGE_CUSTOM : newExchangeId || undefined}
                      onValueChange={(v) => {
                        if (v === EXCHANGE_CUSTOM) {
                          setExchangeCustom(true);
                          setNewExchangeId("");
                          setNewName("");
                          return;
                        }
                        setExchangeCustom(false);
                        setNewExchangeId(v);
                        const ex = exchanges.find((e) => String(e.id) === v);
                        if (ex) setNewName(ex.name);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exchange" />
                      </SelectTrigger>
                      <SelectContent>
                        {exchanges.map((ex) => (
                          <SelectItem key={ex.id} value={String(ex.id)}>
                            {ex.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={EXCHANGE_CUSTOM} className="text-muted-foreground">
                          Add custom exchange…
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {exchangeCustom && (
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter exchange name"
                      />
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Opening balance</Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={openingBalance || ""}
                    onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <Button className="mt-3" size="sm" onClick={createAccount} disabled={saving}>
                Create account
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t px-6 py-4">
          <span className="text-sm text-muted-foreground">
            {mode === "top_up" && totalFreeBets > 0 ? (
              <>
                Cash:{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    totalCash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-negative"
                  )}
                >
                  {formatGbp(totalCash, { signed: true })}
                </span>
                {" · "}
                Free bets:{" "}
                <span className="font-semibold tabular-nums text-violet-600">
                  {formatGbp(totalFreeBets, { signed: true })}
                </span>
              </>
            ) : (
              <>
                Net change:{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    totalDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-negative"
                  )}
                >
                  {formatGbp(totalDelta, { signed: true })}
                </span>
              </>
            )}
          </span>
          <Button onClick={save} disabled={saving || accounts.length === 0}>
            Save balances
          </Button>
        </div>
    </DialogContent>
  );
}
