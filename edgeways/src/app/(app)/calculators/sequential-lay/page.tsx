"use client";

import { useEffect, useMemo, useState } from "react";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { useExchanges } from "@/hooks/use-exchanges";
import { type BetMode } from "@/lib/calc/matched";
import { layBounds, layPlanOutcome, type PartLay } from "@/lib/calc/layplan";
import type { ExchangeRow } from "@/lib/db/schema";
import { panelSurface } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const modeLabels: Record<BetMode, string> = {
  qualifying: "Qualifying bet",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Money back if bet loses",
};

export default function SequentialLayCalculatorPage() {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [mode, setMode] = useState<BetMode>("qualifying");
  const [bookmaker, setBookmaker] = useState("");
  const [backStake, setBackStake] = useState(10);
  const [backOdds, setBackOdds] = useState(6);
  const [layOdds, setLayOdds] = useState(5.2);
  const [partLays, setPartLays] = useState<PartLay[]>([{ odds: 5.8, stake: 5 }]);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
      });
    }
  }, [defaultExchange, exchange]);

  const commissionPct = exchange?.commissionPct ?? 2;

  const planInput = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    const validParts = partLays.filter((p) => p.odds > 1 && p.stake > 0);
    return {
      mode,
      backStake,
      backOdds,
      layOdds,
      commission: commissionPct / 100,
      partLays: validParts,
    };
  }, [mode, backStake, backOdds, layOdds, commissionPct, partLays]);

  const bounds = useMemo(() => (planInput ? layBounds(planInput) : null), [planInput]);
  const layStake = layStakeOverride ?? bounds?.standard ?? 0;

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

  const partTotal = partLays.reduce((a, p) => a + (p.stake > 0 ? p.stake : 0), 0);

  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Sequential Lay"
        description="Part lays first, then the rest at current odds."
      />

      <div className={cn(panelSurface, "p-4")}>
        <div className="mb-2 text-sm font-semibold">Back bet type</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(modeLabels) as BetMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                (mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80")
              }
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
      </div>

      <BackPanel
        title="Back Bet"
        exchange={exchange}
        venue={bookmaker}
        chip={
          <BookmakerSelect
            tagTrigger
            value={bookmaker}
            onChange={setBookmaker}
            className="[--pi:var(--panel)] [--pi-dark:var(--panel-dark)]"
          />
        }
      >
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput label="Back odds" value={backOdds} onChange={setBackOdds} min={1} />
          <PanelInput label="Back stake" prefix="£" value={backStake} onChange={setBackStake} min={0} />
        </div>
      </BackPanel>

      <LayPanel
        title="Part lays + final lay"
        exchange={exchange}
        chip={
          <ExchangeSelect
            compact
            tagTrigger
            exchanges={exchanges}
            value={exchange}
            onChange={setExchange}
          />
        }
      >
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput
            label="Lay odds"
            value={layOdds}
            onChange={setLayOdds}
            min={1}
            exchangeOddsStepping
          />
          <LayStakeBanner
            value={layStake}
            liability={result?.totalLiability}
            pending={!planInput}
            label={`Final lay stake${partTotal > 0 ? ` (${partTotal.toFixed(2)} already laid)` : ""}`}
            onChange={(v) =>
              setLayStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
            }
          />
        </div>

        {bounds && (
          <AdvancedLaySection
            bounds={bounds}
            layStake={layStake}
            onLayStake={setLayStakeOverride}
            partLays={partLays}
            onPartLays={setPartLays}
            accent={exchange?.brandColor ?? "#1e293b"}
          />
        )}
        {result && result.totalLayStake > layStake && (
          <p className="text-center text-xs text-muted-foreground">
            Total lay stake across all steps:{" "}
            <span className="font-semibold text-foreground">£{result.totalLayStake.toFixed(2)}</span>
            {result.effectiveLayOdds !== layOdds && (
              <>
                {" "}
                · effective odds{" "}
                <span className="font-semibold text-foreground">
                  {result.effectiveLayOdds.toFixed(2)}
                </span>
              </>
            )}
          </p>
        )}
      </LayPanel>

      <ProfitTable
        rows={rows}
        guaranteed={result?.guaranteed ?? 0}
        exchange={exchange}
        venue={bookmaker}
        totalLabel={mode === "qualifying" ? "Qualifying loss" : "Total profit"}
      />

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${bookmaker ? bookmaker + " " : ""}Sequential lay @ ${backOdds}`,
          betType: mode,
          backStake,
          backOdds,
          layOdds,
          layStake: result?.totalLayStake,
          exchangeId: exchange?.id,
          advanced: true,
          partLays: partLays.filter((p) => p.odds > 1 && p.stake > 0),
          layStakeOverride,
          bookmaker: bookmaker || undefined,
          expectedProfit: result ? Number(result.guaranteed.toFixed(2)) : undefined,
        }}
      />
    </CalculatorShell>
  );
}
