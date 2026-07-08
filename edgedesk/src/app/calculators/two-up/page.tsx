"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelBookieInput,
  PanelInput,
} from "@/components/calc/bet-panels";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow } from "@/components/money-flow";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { contrastText } from "@/lib/brands/exchanges";
import { useExchanges } from "@/hooks/use-exchanges";
import { twoUp, twoUpEV } from "@/lib/calc";
import type { ExchangeRow } from "@/lib/db/schema";
import { Sparkles } from "lucide-react";

export default function TwoUpCalculatorPage() {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [bookmaker, setBookmaker] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [backedSide, setBackedSide] = useState<"home" | "away">("home");
  const [backStake, setBackStake] = useState(50);
  const [backOdds, setBackOdds] = useState(3);
  const [layOdds, setLayOdds] = useState(3.1);
  const [commission, setCommission] = useState(2);
  const [pWin, setPWin] = useState(32);
  const [pWindfall, setPWindfall] = useState(6);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
        setCommission(defaultExchange.commissionPct);
      });
    }
  }, [defaultExchange, exchange]);

  const result = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return twoUp({ backStake, backOdds, layOdds, commission: commission / 100 });
  }, [backStake, backOdds, layOdds, commission]);

  const ev = useMemo(() => {
    if (!result) return null;
    return twoUpEV(result, pWin / 100, pWindfall / 100);
  }, [result, pWin, pWindfall]);

  const backedName = backedSide === "home" ? homeTeam : awayTeam;

  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Early Payout (2UP) Calculator"
        description={
          <>
            Back at a bookie that pays out at 2 goals ahead, lay at the exchange. Small qualifying
            loss, big windfall when the payout triggers and the result flips. For the full
            model-driven desk, see the{" "}
            <Link href="/calculators/ep-desk" className="text-primary underline-offset-2 hover:underline">
              EP Desk
            </Link>
            .
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-sm font-semibold">Match (optional)</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Name the match and the profit tracker will link it — the windfall settles itself the
          moment your team goes 2 up and the result flips.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Home team</span>
            <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="e.g. Arsenal" className="h-10" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Away team</span>
            <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="e.g. Liverpool" className="h-10" />
          </label>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <span className="text-[11px] font-medium text-muted-foreground">Team you&apos;re backing</span>
            <div className="flex h-10 items-center gap-1 rounded-md border p-1">
              {(["home", "away"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setBackedSide(side)}
                  className={
                    "h-full flex-1 rounded text-xs font-medium transition-colors " +
                    (backedSide === side ? "bg-primary text-primary-foreground" : "hover:bg-muted")
                  }
                >
                  {side === "home" ? homeTeam || "Home" : awayTeam || "Away"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BackPanel title="Back Bet" exchange={exchange}>
        <div className="grid grid-cols-2 gap-3">
          <PanelBookieInput
            value={bookmaker}
            onChange={setBookmaker}
            placeholder="e.g. Paddy Power"
            className="col-span-2 sm:col-span-1"
          />
          <PanelInput label="Back stake" prefix="£" value={backStake} onChange={setBackStake} min={0} />
          <PanelInput label="Back odds (decimal)" value={backOdds} onChange={setBackOdds} min={1} />
        </div>
      </BackPanel>

      <LayPanel
        title="Lay Bet"
        exchange={exchange}
        chip={
          exchange ? (
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: exchange.brandColor,
                color: contrastText(exchange.brandColor),
              }}
            >
              {exchange.name.toUpperCase()}
            </span>
          ) : null
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
              }}
            />
          </div>
          <PanelInput label="Lay odds (decimal)" value={layOdds} onChange={setLayOdds} min={1} exchangeOddsStepping />
          <PanelInput label="Lay commission" suffix="%" value={commission} onChange={setCommission} min={0} step={0.5} />
        </div>
        <LayStakeBanner value={result?.layStake ?? 0} liability={result?.liability} />
      </LayPanel>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outcomes</CardTitle>
          <CardDescription>Windfall highlighted — the reason this offer is played.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(result?.scenarios ?? []).map((scenario) => (
            <div
              key={scenario.key}
              className={
                "flex items-center justify-between rounded-md border px-3 py-2.5 text-sm " +
                (scenario.key === "windfall"
                  ? "border-emerald-300 bg-emerald-50/60 font-medium dark:border-emerald-800 dark:bg-emerald-950/40"
                  : "")
              }
            >
              <span>{scenario.label}</span>
              <MoneyFlow value={scenario.profit} signColor signDisplay className="font-semibold" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" /> Expected value of this position
          </CardTitle>
          <CardDescription>
            Weight the scenarios by your probability estimates to see the true EV.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 items-end gap-4">
          <NumField label="P(team wins) %" value={pWin} onChange={setPWin} min={0} step={1} />
          <NumField
            label="P(2 up then fails) %"
            value={pWindfall}
            onChange={setPWindfall}
            min={0}
            step={0.5}
            hint="Historically ~3–8%"
          />
          <div className="pb-1 text-right">
            <div className="text-xs text-muted-foreground">EV</div>
            <MoneyFlow value={ev ?? 0} signColor signDisplay className="text-2xl font-semibold" />
          </div>
        </CardContent>
      </Card>

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${bookmaker ? bookmaker + " " : ""}2UP ${backedName || "back/lay"} @ ${backOdds}`,
          betType: "qualifying",
          backStake,
          backOdds,
          layOdds,
          layStake: result?.layStake,
          exchangeId: exchange?.id,
          bookmaker: bookmaker || undefined,
          homeTeam: homeTeam || undefined,
          awayTeam: awayTeam || undefined,
          market: "match_odds",
          selection: backedSide,
          earlyPayout: true,
          expectedProfit: result ? Number(result.qualifyingLoss.toFixed(2)) : undefined,
        }}
      />
    </CalculatorShell>
  );
}
