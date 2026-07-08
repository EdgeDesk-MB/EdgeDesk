"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelBookieInput,
  PanelInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { EdgePanel } from "@/components/calc/edge-panel";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { PercentFlow } from "@/components/money-flow";
import { contrastText } from "@/lib/brands/exchanges";
import { useExchanges } from "@/hooks/use-exchanges";
import { layBounds, layPlanOutcome, executableLayStake, type BetMode, type PartLay } from "@/lib/calc";
import type { ExchangeRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import type { MatchedCalculatorPrefill } from "@/components/matched-calculator-provider";

const modeLabels: Record<BetMode, string> = {
  qualifying: "Qualifying bet",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Money back if bet loses",
};

const modeHints: Record<BetMode, string> = {
  qualifying: "Placing a bet to qualify for a free bet or bonus.",
  free_snr: "Converting a free bet into cash — stake not returned.",
  free_sr: "Free bet where the stake IS returned on a win.",
  risk_free: "Losing stakes are refunded (usually as a free bet).",
};

export function MatchedCalculator({
  className,
  prefill,
  open = true,
}: {
  className?: string;
  prefill?: MatchedCalculatorPrefill;
  open?: boolean;
}) {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [mode, setMode] = useState<BetMode>("qualifying");
  const [bookmaker, setBookmaker] = useState("");
  const [backStake, setBackStake] = useState(10);
  const [backOdds, setBackOdds] = useState(3);
  const [layOdds, setLayOdds] = useState(3.1);
  const [commission, setCommission] = useState(2);
  const [refundAmount, setRefundAmount] = useState(10);
  const [refundRetention, setRefundRetention] = useState(70);
  const [advanced, setAdvanced] = useState(false);
  const [partLays, setPartLays] = useState<PartLay[]>([]);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
        setCommission(defaultExchange.commissionPct);
      });
    }
  }, [defaultExchange, exchange]);

  useEffect(() => {
    if (!open || !prefill) return;

    if (prefill.mode) setMode(prefill.mode);
    if (prefill.bookmaker) setBookmaker(prefill.bookmaker);
    if (prefill.backStake !== undefined) setBackStake(prefill.backStake);
    if (prefill.backOdds !== undefined) setBackOdds(prefill.backOdds);
    if (prefill.layOdds !== undefined) setLayOdds(prefill.layOdds);
    if (prefill.advanced !== undefined) setAdvanced(prefill.advanced);
    if (prefill.partLays) setPartLays(prefill.partLays);
    if (prefill.layStakeOverride !== undefined) setLayStakeOverride(prefill.layStakeOverride);
    if (prefill.refundAmount !== undefined) setRefundAmount(prefill.refundAmount);
    if (prefill.refundRetention !== undefined) setRefundRetention(prefill.refundRetention);

    if (prefill.exchangeId !== undefined) {
      const ex = exchanges.find((e) => e.id === prefill.exchangeId);
      if (ex) {
        setExchange(ex);
        if (prefill.commission === undefined) setCommission(ex.commissionPct);
      }
    }
    if (prefill.commission !== undefined) setCommission(prefill.commission);
  }, [open, prefill, exchanges]);

  const planInput = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return {
      mode,
      backStake,
      backOdds,
      layOdds,
      commission: commission / 100,
      partLays: advanced ? partLays.filter((p) => p.odds > 1 && p.stake > 0) : [],
      refundAmount,
      refundRetention: refundRetention / 100,
    };
  }, [mode, backStake, backOdds, layOdds, commission, advanced, partLays, refundAmount, refundRetention]);

  const bounds = useMemo(() => (planInput ? layBounds(planInput) : null), [planInput]);

  const layStake = useMemo(() => {
    if (!planInput) return 0;
    const override = advanced && layStakeOverride != null ? layStakeOverride : null;
    return executableLayStake(planInput, override);
  }, [planInput, advanced, layStakeOverride]);

  const result = useMemo(
    () => (planInput ? layPlanOutcome({ ...planInput, layStake }) : null),
    [planInput, layStake]
  );

  const rows = useMemo(() => {
    if (!result) return [];
    return [
      {
        label: "If back (bookie) bet wins",
        bookie: result.ifBackWins.bookie,
        exchange: result.ifBackWins.exchange,
        accent: "back" as const,
      },
      {
        label: "If lay (exchange) bet wins",
        bookie: result.ifBackLoses.bookie,
        exchange: result.ifBackLoses.exchange,
        accent: "lay" as const,
      },
    ];
  }, [result]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Select bet type</div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as BetMode)}>
          <TabsList className="h-auto flex-wrap">
            {(Object.keys(modeLabels) as BetMode[]).map((m) => (
              <TabsTrigger key={m} value={m}>
                {modeLabels[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="pt-2 text-xs text-muted-foreground">{modeHints[mode]}</p>
      </div>

      <BackPanel title="Back Bet" exchange={exchange}>
        <div className="grid grid-cols-2 gap-3">
          <PanelBookieInput
            value={bookmaker}
            onChange={setBookmaker}
            className="col-span-2 sm:col-span-1"
          />
          <PanelInput label="Back stake" prefix="£" value={backStake} onChange={setBackStake} min={0} />
          <PanelInput label="Back odds (decimal)" value={backOdds} onChange={setBackOdds} min={1} />
          {mode === "risk_free" && (
            <>
              <PanelInput label="Refund amount" prefix="£" value={refundAmount} onChange={setRefundAmount} min={0} />
              <PanelInput
                label="Refund retention"
                suffix="%"
                value={refundRetention}
                onChange={setRefundRetention}
                min={0}
                step={5}
              />
            </>
          )}
        </div>
      </BackPanel>

      <LayPanel
        title="Lay Bet"
        exchange={exchange}
        chip={
          <span className="flex items-center gap-3">
            {exchange && (
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: exchange.brandColor,
                  color: contrastText(exchange.brandColor),
                }}
              >
                {exchange.name.toUpperCase()}
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs font-semibold text-black/70 dark:text-white/80">
              Advanced
              <Switch
                checked={advanced}
                onCheckedChange={(on) => {
                  setAdvanced(on);
                  if (!on) {
                    setPartLays([]);
                    setLayStakeOverride(null);
                  }
                }}
              />
            </label>
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <ExchangeSelect
              onPanel
              exchanges={exchanges}
              value={exchange}
              onChange={(ex) => {
                setExchange(ex);
                setCommission(ex.commissionPct);
                toast.info(`${ex.name} selected`, { description: `Commission set to ${ex.commissionPct}%` });
              }}
            />
          </div>
          <PanelInput
            label="Lay odds (decimal)"
            value={layOdds}
            onChange={setLayOdds}
            min={1}
            exchangeOddsStepping
          />
          <PanelInput
            label="Lay commission"
            suffix="%"
            value={commission}
            onChange={setCommission}
            min={0}
            step={0.5}
          />
        </div>
        {advanced && bounds && (
          <AdvancedLaySection
            bounds={bounds}
            layStake={layStake}
            onLayStake={setLayStakeOverride}
            partLays={partLays}
            onPartLays={setPartLays}
            accent={exchange?.brandColor ?? "#1e293b"}
          />
        )}
        <LayStakeBanner value={layStake} liability={result?.totalLiability} />
      </LayPanel>

      <ProfitTable
        rows={rows}
        guaranteed={result?.guaranteed ?? 0}
        exchange={exchange}
        totalLabel={mode === "qualifying" ? "Qualifying loss" : "Total profit"}
      />

      {(mode === "free_snr" || mode === "free_sr") && result && (
        <div className="text-center text-xs text-muted-foreground">
          Free bet retention:{" "}
          <span className="font-semibold text-foreground">
            <PercentFlow value={(result.guaranteed / backStake) * 100} digits={1} />
          </span>{" "}
          of face value.
        </div>
      )}

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${bookmaker ? bookmaker + " " : ""}${modeLabels[mode]} @ ${backOdds}`,
          betType: mode,
          backStake,
          backOdds,
          layOdds,
          layStake: result?.totalLayStake,
          exchangeId: exchange?.id,
          advanced,
          partLays,
          layStakeOverride,
          bookmaker: bookmaker || undefined,
          expectedProfit: result ? Number(result.guaranteed.toFixed(2)) : undefined,
        }}
      />

      <EdgePanel backOdds={backOdds} layOdds={layOdds} stake={backStake} />
    </div>
  );
}
