"use client";

import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogSaveButton } from "@/components/ui/dialog-save-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { AccountTypeBadge } from "@/components/accounts/account-type-badge";
import type { AccountBalance } from "@/lib/services/balances.types";
import { bookieBrandColor } from "@/lib/brands/bookies";
import { BookieNamePicker, EXCHANGE_CUSTOM } from "@/components/bookie-name-picker";
import { formatGbp, isNegativeGbp, roundMoney } from "@/lib/format-money";
import { quietPanel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  SlidersHorizontal,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";

export type FundKind = "cash" | "free_bet";
export type AdjustBalanceMode = "top_up" | "withdrawal" | "adjustment";

export type AddBalanceOpenOpts = {
  accountId?: number;
  accountName?: string;
  amount?: number;
};

interface TopUpRow {
  rowKey: string;
  accountId: number;
  amount: number;
  note: string;
  fundKind: FundKind;
}

let rowKeySeq = 0;
function nextRowKey(): string {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
}

const MODE_TABS: {
  value: AdjustBalanceMode;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  {
    value: "top_up",
    label: "Top up",
    icon: ArrowDownToLine,
    iconClass: "text-profit",
  },
  {
    value: "withdrawal",
    label: "Withdraw",
    icon: ArrowUpFromLine,
    iconClass: "text-negative",
  },
  {
    value: "adjustment",
    label: "Adjust",
    icon: SlidersHorizontal,
    iconClass: "text-muted-foreground",
  },
];

function rowGridClass(mode: AdjustBalanceMode): string {
  return mode === "top_up"
    ? "sm:grid-cols-[minmax(0,1.5fr)_7.5rem_7.5rem_minmax(0,1fr)_2rem]"
    : "sm:grid-cols-[minmax(0,1.5fr)_7.5rem_minmax(0,1fr)_2rem]";
}

function resolveSeedAccount(
  accounts: AccountBalance[],
  initial?: AddBalanceOpenOpts | null
): AccountBalance | undefined {
  if (initial?.accountId != null) {
    const byId = accounts.find((a) => a.id === initial.accountId);
    if (byId) return byId;
    // Prefer name match over a wrong fallback while accounts catch up after ensure.
    const q = initial.accountName?.trim().toLowerCase();
    if (q) {
      return accounts.find((a) => a.name.toLowerCase() === q);
    }
    return undefined;
  }
  const q = initial?.accountName?.trim().toLowerCase();
  if (q) {
    return accounts.find((a) => a.name.toLowerCase() === q);
  }
  return accounts[0];
}

export function AddBalanceDialog({
  open,
  onOpenChange,
  accounts,
  onSaved,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountBalance[];
  onSaved: () => void;
  initial?: AddBalanceOpenOpts | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Gate on open: the form renders DialogContent itself, so it must be
          unmounted explicitly for state to reset between opens. */}
      {open ? (
        <AddBalanceForm
          accounts={accounts}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          initial={initial}
        />
      ) : null}
    </Dialog>
  );
}

/**
 * Controlled value for a balance amount field.
 * `amount || ""` treats 0 as empty, so Adjust cannot show or keep a £0 target
 * (the current-balance placeholder then looks like the typed 0 did nothing).
 */
export function balanceAmountInputValue(
  amount: number,
  mode: AdjustBalanceMode
): number | "" {
  if (mode !== "adjustment" && amount === 0) return "";
  return Number.isFinite(amount) ? amount : "";
}

export function ledgerAmountForRow(
  mode: AdjustBalanceMode,
  amount: number,
  currentBalance: number
): number {
  if (mode === "adjustment") return roundMoney(amount - currentBalance);
  if (mode === "withdrawal") return roundMoney(-Math.abs(amount));
  return roundMoney(amount);
}

export function nextUnusedAccountId(
  accounts: { id: number }[],
  usedIds: readonly number[]
): number | undefined {
  if (accounts.length === 0) return undefined;
  const used = new Set(usedIds);
  return (accounts.find((a) => !used.has(a.id)) ?? accounts[0]).id;
}

export function balanceDeltaClass(amount: number): string {
  if (isNegativeGbp(amount)) return "text-negative";
  if (roundMoney(amount) > 0) return "text-profit";
  return "text-muted-foreground";
}

export type AdjustFooterBreakdown = {
  name: string;
  amount: number;
  fundKind: FundKind;
};

export type AdjustFooterModel = {
  headlineLabel: string;
  headlineAmount: number;
  headlineSigned: boolean;
  supportingNewBalance: number | null;
  supportingDelta: number | null;
  freeBetAmount: number;
};

export function adjustBalanceFooterModel(opts: {
  mode: AdjustBalanceMode;
  affectPnl: boolean;
  cashDelta: number;
  freeBetAmount: number;
  newBalance: number | null;
  breakdown: AdjustFooterBreakdown[];
}): AdjustFooterModel {
  const contributing = opts.breakdown.filter((row) => roundMoney(row.amount) !== 0);
  const multi = contributing.length > 1;

  if (opts.affectPnl && roundMoney(opts.cashDelta) !== 0) {
    return {
      headlineLabel: isNegativeGbp(opts.cashDelta) ? "Loss" : "Profit",
      headlineAmount: opts.cashDelta,
      headlineSigned: true,
      supportingNewBalance: opts.newBalance,
      supportingDelta: null,
      freeBetAmount: opts.freeBetAmount,
    };
  }

  if (opts.mode === "top_up" && opts.freeBetAmount > 0) {
    return {
      headlineLabel: "Cash",
      headlineAmount: opts.cashDelta,
      headlineSigned: true,
      supportingNewBalance: null,
      supportingDelta: null,
      freeBetAmount: opts.freeBetAmount,
    };
  }

  if (opts.mode === "top_up" && opts.newBalance != null && !multi) {
    return {
      headlineLabel: "New balance",
      headlineAmount: opts.newBalance,
      headlineSigned: false,
      supportingNewBalance: null,
      supportingDelta: roundMoney(opts.cashDelta) !== 0 ? opts.cashDelta : null,
      freeBetAmount: 0,
    };
  }

  return {
    headlineLabel: "Net change",
    headlineAmount: opts.cashDelta,
    headlineSigned: true,
    supportingNewBalance: null,
    supportingDelta: null,
    freeBetAmount: 0,
  };
}

export function adjustPnlHelpText(opts: {
  enabled: boolean;
  mode: "top_up" | "adjustment";
  cashRowCount: number;
  cashDelta: number;
}): string {
  if (!opts.enabled) {
    return opts.cashRowCount > 1
      ? "Wallet move only. Turn on to count every cash row as profit or loss."
      : "Wallet move only. Turn on to count this cash movement as profit or loss.";
  }
  if (opts.cashRowCount === 0) {
    return "Counts cash rows as profit or loss. Free bets stay off P&L.";
  }
  const signed = formatGbp(opts.cashDelta, { signed: true });
  const asWhat = isNegativeGbp(opts.cashDelta)
    ? "loss"
    : roundMoney(opts.cashDelta) > 0
      ? "profit"
      : "profit or loss";
  if (opts.cashRowCount <= 1) {
    return opts.mode === "top_up"
      ? `Records this cash movement as ${asWhat} (${signed}) on Home and History.`
      : `Records this correction as ${asWhat} (${signed}) on Home and History.`;
  }
  return `Applies to all ${opts.cashRowCount} cash rows. Home and History will show ${signed} as ${asWhat}.`;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="sm:hidden">
      <Label className="text-xs text-muted-foreground">{children}</Label>
    </div>
  );
}

function seedRow(
  account: AccountBalance | undefined,
  mode: AdjustBalanceMode,
  amount?: number
): TopUpRow[] {
  if (!account) return [];
  const seededAmount =
    mode === "adjustment"
      ? roundMoney(account.balance)
      : amount != null && amount > 0
        ? roundMoney(amount)
        : 0;
  return [
    {
      rowKey: `seed-${account.id}`,
      accountId: account.id,
      amount: seededAmount,
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
  initial,
}: {
  accounts: AccountBalance[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initial?: AddBalanceOpenOpts | null;
}) {
  const { exchanges } = useExchanges();
  const pnlId = useId();
  const seedAccount = resolveSeedAccount(accounts, initial);
  const [mode, setMode] = useState<AdjustBalanceMode>("top_up");
  const [rows, setRows] = useState<TopUpRow[]>(() =>
    seedRow(seedAccount, "top_up", initial?.amount)
  );
  const [affectPnl, setAffectPnl] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAddAccount, setShowAddAccount] = useState(
    () => !seedAccount && Boolean(initial?.accountName?.trim())
  );
  const [newType, setNewType] = useState<"bookie" | "exchange" | "bank">("bookie");
  const [newName, setNewName] = useState(() => initial?.accountName?.trim() ?? "");
  const [newExchangeId, setNewExchangeId] = useState<string>("");
  const [exchangeCustom, setExchangeCustom] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(() =>
    initial?.amount != null && initial.amount > 0 ? roundMoney(initial.amount) : 0
  );

  const effectiveRows = rows.length > 0 ? rows : seedRow(seedAccount, mode, initial?.amount);

  /** Keep account, amount, note, and type. Mode only changes how those values save. */
  function changeMode(next: AdjustBalanceMode) {
    if (rows.length === 0 && effectiveRows.length > 0) {
      setRows(effectiveRows);
    }
    setMode(next);
  }

  function rowLedgerAmount(row: TopUpRow): number {
    const account = accounts.find((a) => a.id === row.accountId);
    return ledgerAmountForRow(mode, row.amount, account?.balance ?? 0);
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
          ...((mode === "adjustment" || mode === "top_up") &&
          affectPnl &&
          categoryForRow(r) !== "free_bet"
            ? { affectPnl: true }
            : {}),
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

  const cashRows = effectiveRows.filter((r) => categoryForRow(r) !== "free_bet");
  const cashDelta = roundMoney(cashRows.reduce((s, r) => s + rowLedgerAmount(r), 0));
  const contributingCashRows = cashRows.filter((r) => rowLedgerAmount(r) !== 0);

  const totalFreeBets =
    mode === "top_up"
      ? effectiveRows
          .filter((r) => r.fundKind === "free_bet")
          .reduce((s, r) => s + Math.abs(r.amount), 0)
      : 0;

  const topUpCashRows = mode === "top_up" ? effectiveRows.filter((r) => r.fundKind === "cash") : [];
  const topUpAccountIds = new Set(topUpCashRows.map((r) => r.accountId));
  const topUpNewBalance =
    topUpAccountIds.size === 1
      ? roundMoney(
          (accounts.find((a) => a.id === topUpCashRows[0]!.accountId)?.balance ?? 0) +
            topUpCashRows.reduce((s, r) => s + Math.abs(r.amount), 0)
        )
      : null;

  const footer = adjustBalanceFooterModel({
    mode,
    affectPnl: affectPnl && (mode === "top_up" || mode === "adjustment"),
    cashDelta,
    freeBetAmount: totalFreeBets,
    newBalance: topUpNewBalance,
    breakdown: effectiveRows.map((row) => {
      const account = accounts.find((a) => a.id === row.accountId);
      return {
        name: account?.name ?? "Account",
        amount: rowLedgerAmount(row),
        fundKind: row.fundKind,
      };
    }),
  });

  const showPnl = mode === "adjustment" || mode === "top_up";
  const hasDelta = effectiveRows.some((r) => rowLedgerAmount(r) !== 0);
  const amountLabel = mode === "adjustment" ? "New balance" : "Amount";

  return (
    <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="mx-0 mt-0">
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription
            explainer={
              <DialogExplainer title="Adjust balance">
                Top up or withdraw from a bookie or exchange, or set the wallet
                to a known balance. Include in P&amp;L counts every cash row as
                profit or loss. Free bets stay off P&amp;L.
              </DialogExplainer>
            }
          >
            Top up, withdraw, or set a balance.
          </DialogDescription>
        </DialogHeader>

        <ScrollFadeEdges
          className="min-h-0 min-w-0 flex-1"
          fadeClassName="from-page dark:from-card"
          scrollClassName="app-scroll-nested flex flex-col gap-4 overflow-x-hidden p-4 sm:p-6"
        >
          <div className="inline-flex max-w-full">
            <Tabs
              value={mode}
              onValueChange={(v) => changeMode(v as AdjustBalanceMode)}
              activationMode="manual"
              className="w-auto max-w-full"
            >
              <TabsList
                variant="segmented"
                aria-label="Balance action"
                fadeClassName="from-page dark:from-card"
                className="w-max min-w-0"
              >
                {MODE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex-none group-data-[variant=segmented]/tabs-list:!flex-none"
                    >
                      <Icon className={cn("size-3.5 shrink-0", tab.iconClass)} />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          {accounts.length === 0 && !showAddAccount && (
            <EmptyState
              compact
              oneLine
              icon={Wallet}
              title="No accounts yet"
              description="Add a bookie or exchange wallet first."
            />
          )}

          {effectiveRows.length > 0 && (
            <div className="flex min-w-0 flex-col gap-3 sm:gap-0">
              <div
                className={cn(
                  "hidden sm:grid sm:items-end sm:gap-2 sm:border-b sm:border-border/60 sm:pb-2",
                  rowGridClass(mode)
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">Account</p>
                {mode === "top_up" ? (
                  <p className="text-xs font-medium text-muted-foreground">Type</p>
                ) : null}
                <p className="text-xs font-medium text-muted-foreground">{amountLabel}</p>
                <p className="text-xs font-medium text-muted-foreground">Note</p>
                <p className="sr-only">Remove</p>
              </div>

              {effectiveRows.map((row, i) => {
                const account = accounts.find((a) => a.id === row.accountId);
                const canFreeBet = mode === "top_up" && account?.type === "bookie";
                const delta = rowLedgerAmount(row);

                const showRowDelta = mode === "adjustment" && delta !== 0;

                return (
                  <div
                    key={row.rowKey}
                    className={cn(
                      "grid min-w-0 items-start gap-2 grid-cols-1 gap-3 p-3",
                      "max-sm:rounded-md max-sm:border max-sm:border-border/60 max-sm:bg-muted/30",
                      "sm:border-b sm:border-border/60 sm:p-0 sm:py-2 sm:last:border-b-0",
                      rowGridClass(mode)
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <FieldLabel>Account</FieldLabel>
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
                        <SelectTrigger className="w-full min-w-0" aria-label="Account">
                          {account ? (
                            <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                              <span className="min-w-0 truncate" title={account.name}>
                                {account.name}
                              </span>
                              <AccountTypeBadge type={account.type} />
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {formatGbp(account.balance)}
                              </span>
                            </span>
                          ) : (
                            <SelectValue placeholder="Account" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              <span className="flex items-center gap-1.5">
                                <span>{a.name}</span>
                                <AccountTypeBadge type={a.type} />
                                <span className="shrink-0 text-muted-foreground">
                                  · {formatGbp(a.balance)}
                                  {a.type === "bookie" && (a.freeBets ?? 0) > 0 && (
                                    <> · FB {formatGbp(a.freeBets ?? 0)}</>
                                  )}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:contents">
                      {mode === "top_up" && (
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <FieldLabel>Type</FieldLabel>
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
                            <SelectTrigger className="w-full" aria-label="Type">
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
                      <div className="flex min-w-0 flex-col gap-1">
                        <FieldLabel>{amountLabel}</FieldLabel>
                        <div className="relative">
                          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                            £
                          </span>
                          <Input
                            type="number"
                            step={0.01}
                            min={mode === "adjustment" ? undefined : 0}
                            value={balanceAmountInputValue(row.amount, mode)}
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
                            aria-label={amountLabel}
                            className="tabular-nums pl-7"
                          />
                        </div>
                        {showRowDelta ? (
                          <p className={cn("text-xs tabular-nums", balanceDeltaClass(delta))}>
                            {formatGbp(delta, { signed: true })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-2 sm:contents">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <FieldLabel>Note</FieldLabel>
                        <Input
                          value={row.note}
                          onChange={(e) =>
                            setRows(
                              effectiveRows.map((r, j) =>
                                j === i ? { ...r, note: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Optional"
                          aria-label="Note"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground sm:self-start"
                        disabled={effectiveRows.length <= 1}
                        aria-label={
                          account ? `Remove ${account.name} row` : "Remove row"
                        }
                        onClick={() => setRows(effectiveRows.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={accounts.length === 0}
              onClick={() => {
                const accountId = nextUnusedAccountId(
                  accounts,
                  effectiveRows.map((r) => r.accountId)
                );
                const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
                if (!account) return;
                setRows([
                  ...effectiveRows,
                  {
                    rowKey: nextRowKey(),
                    accountId: account.id,
                    amount: mode === "adjustment" ? roundMoney(account.balance) : 0,
                    note: "",
                    fundKind: "cash",
                  },
                ]);
              }}
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
            <div className={cn(quietPanel, "p-4")}>
              <p className="mb-3 text-sm font-semibold">Add account</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                    <SelectTrigger className="w-full">
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
                      <SelectTrigger className="w-full">
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
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      £
                    </span>
                    <Input
                      type="number"
                      step={0.01}
                      value={openingBalance || ""}
                      onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      aria-label="Opening balance"
                      className="tabular-nums pl-7"
                    />
                  </div>
                </div>
              </div>
              <Button className="mt-3" size="sm" onClick={createAccount} disabled={saving}>
                Create account
              </Button>
            </div>
          )}
        </ScrollFadeEdges>

        <div className="shrink-0 border-t">
          {showPnl && (
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <label htmlFor={pnlId} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium">Include in P&amp;L</span>
                <span
                  id={`${pnlId}-help`}
                  className="mt-0.5 block text-xs text-pretty text-muted-foreground"
                >
                  {adjustPnlHelpText({
                    enabled: affectPnl,
                    mode: mode === "adjustment" ? "adjustment" : "top_up",
                    cashRowCount: contributingCashRows.length,
                    cashDelta,
                  })}
                </span>
              </label>
              <Switch
                id={pnlId}
                checked={affectPnl}
                onCheckedChange={setAffectPnl}
                aria-describedby={`${pnlId}-help`}
              />
            </div>
          )}
          <div className="flex flex-col flex-wrap gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">{footer.headlineLabel}:</span>{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    footer.headlineSigned
                      ? balanceDeltaClass(footer.headlineAmount)
                      : "text-foreground"
                  )}
                >
                  {formatGbp(footer.headlineAmount, { signed: footer.headlineSigned })}
                </span>
                {footer.supportingDelta != null ? (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        balanceDeltaClass(footer.supportingDelta)
                      )}
                    >
                      {formatGbp(footer.supportingDelta, { signed: true })}
                    </span>
                  </>
                ) : null}
                {footer.supportingNewBalance != null ? (
                  <>
                    {" · "}
                    New balance{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatGbp(footer.supportingNewBalance)}
                    </span>
                  </>
                ) : null}
                {footer.freeBetAmount > 0 ? (
                  <>
                    {" · "}
                    Free bets:{" "}
                    <span className="font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                      {formatGbp(footer.freeBetAmount, { signed: true })}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <DialogSaveButton
              onClick={save}
              disabled={saving || accounts.length === 0 || !hasDelta}
              className="shrink-0 max-sm:w-full"
            >
              Save balances
            </DialogSaveButton>
          </div>
        </div>
    </DialogContent>
  );
}
