"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import {
  FreeBetsLots,
  useConvertFreeBetLot,
} from "@/components/accounts/free-bet-lots-panel";
import { accountOwner } from "@/lib/accounts/owners";
import { isNegativeGbp } from "@/lib/format-money";
import { useAppState } from "@/hooks/use-app-state";
import {
  dialogTitleIcon,
  listRow,
  listRowGroup,
  quietPanel,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export type BalancesSheetTab = "balances" | "free-bets";

function profitToneClass(value: number): string {
  return isNegativeGbp(value) ? "text-negative" : moneyPositiveClass;
}

export function MobileBalancesDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: BalancesSheetTab;
  onTabChange: (tab: BalancesSheetTab) => void;
}) {
  const router = useRouter();
  const { state } = useAppState(open ? 5_000 : 0);
  const convert = useConvertFreeBetLot(() => onOpenChange(false));
  const balances = state?.balances;
  const exchange = balances?.exchanges ?? 0;
  const inBets = balances?.inBets ?? 0;
  const bankroll = balances?.bankroll ?? balances?.total ?? 0;
  const profit = (state?.settledProfit ?? 0) + (state?.provisionalProfit ?? 0);
  const freeBets =
    balances?.accounts
      ?.filter((a) => a.type === "bookie")
      .reduce((s, a) => s + (a.freeBets ?? 0), 0) ?? 0;
  const freeBetsActive = freeBets > 0.005;
  const ownerLines = useMemo(() => {
    const rows = new Map<string, number>();
    for (const a of balances?.accounts ?? []) {
      if (a.type !== "bookie") continue;
      const owner = accountOwner(a);
      rows.set(owner, (rows.get(owner) ?? 0) + (a.balance ?? 0));
    }
    return [...rows.entries()]
      .map(([owner, balance]) => ({ owner, balance }))
      .sort((a, b) =>
        a.owner === "me" ? -1 : b.owner === "me" ? 1 : a.owner.localeCompare(b.owner)
      );
  }, [balances?.accounts]);

  function closeAndGo(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(36rem,92dvh)] flex-col gap-0 overflow-hidden p-0 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md">
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <Wallet className={dialogTitleIcon} />
            Balances
          </DialogTitle>
          <DialogDescription
            explainer={
              <DialogExplainer title="Balances">
                Profit and bankroll from the hang tab. Free bets lists lots to
                convert.
              </DialogExplainer>
            }
          >
            Wallet, profit and free bets.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as BalancesSheetTab)}
          activationMode="manual"
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 px-[var(--layout-card-x)] pt-[var(--layout-card-x)]">
            <TabsList variant="segmented" className="w-full">
              <TabsTrigger value="balances">Balances</TabsTrigger>
              <TabsTrigger value="free-bets" data-plate="edge">
                Free bets
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollFadeEdges
            className="min-h-0 flex-1"
            fadeClassName="from-page dark:from-card"
            scrollClassName="px-[var(--layout-card-x)] py-[var(--layout-card-x)]"
          >
            <TabsContent value="balances" className="outline-none">
              <div className="flex flex-col gap-3">
                <div className={cn(quietPanel, listRowGroup, "overflow-hidden")}>
                  <BalanceSheetRow
                    label="Profit"
                    value={profit}
                    amountClass={profitToneClass(profit)}
                    selectLabel={`Profit ${profit.toFixed(2)}, open tracker`}
                    onSelect={() => closeAndGo("/tracker?tab=pnl")}
                  />
                  <BalanceSheetRow
                    label="Free bets"
                    value={freeBets}
                    amountClass={freeBetsActive ? "text-edge" : undefined}
                    selectLabel={`Free bets ${freeBets.toFixed(2)}, show lots`}
                    onSelect={() => onTabChange("free-bets")}
                  />
                  <BalanceSheetRow label="Exchange" value={exchange} />
                  {inBets > 0.005 ? (
                    <BalanceSheetRow label="In-bets" value={inBets} />
                  ) : null}
                  <BalanceSheetRow label="Total" value={bankroll} />
                </div>
                {ownerLines.length > 1 ? (
                  <div className={cn(quietPanel, listRowGroup, "overflow-hidden")}>
                    <p className={cn(listRow, "px-3 py-2 text-xs font-semibold text-muted-foreground")}>
                      Bookie balances by owner
                    </p>
                    {ownerLines.map((line) => (
                      <BalanceSheetRow
                        key={line.owner}
                        label={line.owner === "me" ? "Me" : line.owner}
                        value={line.balance}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="free-bets" className="outline-none">
              {open ? (
                <FreeBetsLots freeBetTotal={freeBets} onConvert={convert} />
              ) : null}
            </TabsContent>
          </ScrollFadeEdges>
        </Tabs>

        <div className="shrink-0 border-t bg-selection-subtle/50 px-[var(--layout-card-x)] py-[var(--layout-card-x)]">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => closeAndGo("/accounts")}
          >
            Manage accounts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BalanceSheetRow({
  label,
  value,
  amountClass,
  onSelect,
  selectLabel,
}: {
  label: string;
  value: number;
  amountClass?: string;
  onSelect?: () => void;
  selectLabel?: string;
}) {
  const inner = (
    <>
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <MoneyFlow
          value={value}
          className={cn("text-base font-semibold tabular-nums text-foreground", amountClass)}
        />
        {onSelect ? (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </span>
    </>
  );

  const rowClass = cn(
    listRow,
    "flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={selectLabel}
        className={cn(
          rowClass,
          "hover:bg-selection-subtle active:bg-selection-subdued",
          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
        )}
      >
        {inner}
      </button>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
