"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelBookieInput,
  PanelInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { PercentFlow } from "@/components/money-flow";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { contrastText } from "@/lib/brands/exchanges";
import { useExchanges } from "@/hooks/use-exchanges";
import { matchedBet, riskFreeBookieBreakdown, riskFreeRefundCash } from "@/lib/calc/matched";
import type { ExchangeRow } from "@/lib/db/schema";

const RETENTION_PRESETS = [
  { pct: 70, label: "70%" },
  { pct: 75, label: "75% (typical SNR)" },
  { pct: 80, label: "80%" },
  { pct: 100, label: "100% (cash refund)" },
];

export default function RefundIfCalculatorPage() {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [bookmaker, setBookmaker] = useState("");
  const [backStake, setBackStake] = useState(10);
  const [backOdds, setBackOdds] = useState(3);
  const [layOdds, setLayOdds] = useState(3.1);
  const [commission, setCommission] = useState(2);
  const [refundAmount, setRefundAmount] = useState(10);
  const [refundRetention, setRefundRetention] = useState(75);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
        setCommission(defaultExchange.commissionPct);
      });
    }
  }, [defaultExchange, exchange]);

  useEffect(() => {
    queueMicrotask(() => setRefundAmount(backStake));
  }, [backStake]);

  const result = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return matchedBet({
      mode: "risk_free",
      backStake,
      backOdds,
      layOdds,
      commission: commission / 100,
      refundAmount,
      refundRetention: refundRetention / 100,
    });
  }, [backStake, backOdds, layOdds, commission, refundAmount, refundRetention]);

  const refundCash = riskFreeRefundCash({
    backStake,
    refundAmount,
    refundRetention: refundRetention / 100,
  });

  const displayRows = useMemo(() => {
    if (!result) return [];
    const layWinnings = result.layStake * (1 - commission / 100);
    return [
      {
        label: "If back bet wins",
        bookie: backStake * (backOdds - 1),
        exchange: -result.liability,
        accent: "back" as const,
      },
      {
        label: "If back bet loses (refund)",
        bookie: -backStake + refundCash,
        exchange: layWinnings,
        accent: "lay" as const,
        bookieBreakdown: riskFreeBookieBreakdown({
          backStake,
          refundAmount,
          refundRetention: refundRetention / 100,
        })?.lines,
      },
    ];
  }, [result, backStake, backOdds, refundCash, refundAmount, refundRetention, commission]);

  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Refund-If"
        description="Money-back-if-you-lose: cash or free-bet refund."
      />

      <BackPanel title="Back bet (refund offer)" exchange={exchange} venue={bookmaker}>
        <div className="grid grid-cols-2 gap-3">
          <PanelBookieInput
            value={bookmaker}
            onChange={setBookmaker}
            className="col-span-2 sm:col-span-1"
          />
          <PanelInput label="Back stake" prefix="£" value={backStake} onChange={setBackStake} min={0} />
          <PanelInput label="Back odds (decimal)" value={backOdds} onChange={setBackOdds} min={1} />
          <PanelInput
            label="Refund amount"
            prefix="£"
            value={refundAmount}
            onChange={setRefundAmount}
            min={0}
          />
          <div className="col-span-2 flex flex-col gap-1.5">
            <PanelInput
              label="Refund retention"
              suffix="%"
              value={refundRetention}
              onChange={setRefundRetention}
              min={0}
              step={5}
            />
            <div className="flex flex-wrap gap-1.5">
              {RETENTION_PRESETS.map((p) => (
                <button
                  key={p.pct}
                  type="button"
                  onClick={() => setRefundRetention(p.pct)}
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors " +
                    (refundRetention === p.pct
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BackPanel>

      <LayPanel
        title="Lay bet"
        exchange={exchange}
        chip={
          exchange && (
            <span
              className="rounded px-2 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: exchange.brandColor,
                color: contrastText(exchange.brandColor),
              }}
            >
              {exchange.name.toUpperCase()}
            </span>
          )
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
                toast.info(`${ex.name} selected`, {
                  description: `Commission set to ${ex.commissionPct}%`,
                });
              }}
            />
          </div>
          <PanelInput label="Lay odds (decimal)" value={layOdds} onChange={setLayOdds} min={1} exchangeOddsStepping />
          <PanelInput
            label="Lay commission"
            suffix="%"
            value={commission}
            onChange={setCommission}
            min={0}
            step={0.5}
          />
        </div>
        <LayStakeBanner value={result?.layStake ?? 0} liability={result?.liability} />
      </LayPanel>

      <ProfitTable
        rows={displayRows}
        guaranteed={result?.guaranteed ?? 0}
        exchange={exchange}
        venue={bookmaker}
        totalLabel="Locked-in profit"
      />

      {result && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Spread vs stake:{" "}
          <PercentFlow
            value={backStake > 0 ? (result.guaranteed / backStake) * 100 : 0}
            digits={1}
          />
        </div>
      )}

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${bookmaker ? bookmaker + " " : ""}Refund-if @ ${backOdds}`,
          betType: "risk_free",
          backStake,
          backOdds,
          layOdds,
          layStake: result?.layStake,
          exchangeId: exchange?.id,
          bookmaker: bookmaker || undefined,
          expectedProfit: result ? Number(result.guaranteed.toFixed(2)) : undefined,
          refundAmount,
          refundRetention: refundRetention / 100,
        }}
      />
    </CalculatorShell>
  );
}
