"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
} from "@/components/calc/bet-panels";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { MoneyFlow } from "@/components/money-flow";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { useExchanges } from "@/hooks/use-exchanges";
import { twoUp } from "@/lib/calc/twoup";
import type { ExchangeRow } from "@/lib/db/schema";
import { panelSurface, sectionNestedTitle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default function TwoUpCalculatorPage() {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [bookmaker, setBookmaker] = useState("");
  const [sportScope, setSportScope] = useState<"football" | "other">("football");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [backedSide, setBackedSide] = useState<"home" | "away">("home");
  const [backStake, setBackStake] = useState(50);
  const [backOdds, setBackOdds] = useState(3);
  const [layOdds, setLayOdds] = useState(3.1);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
      });
    }
  }, [defaultExchange, exchange]);

  const commissionPct = exchange?.commissionPct ?? 2;

  useEffect(() => {
    queueMicrotask(() => setLayStakeOverride(null));
  }, [backStake, backOdds, layOdds, commissionPct]);

  const result = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return twoUp({
      backStake,
      backOdds,
      layOdds,
      commission: commissionPct / 100,
      layStakeOverride: layStakeOverride ?? undefined,
    });
  }, [backStake, backOdds, layOdds, commissionPct, layStakeOverride]);

  const backedName = backedSide === "home" ? homeTeam : awayTeam;

  return (
    <CalculatorShell>
      <CalculatorPageHeader
        title="Early Payout"
        description={
          <>
            Back an early-payout bookie and lay the exchange, with the full model on{" "}
            <Link href="/early-payout" className="text-primary-text underline-offset-2 hover:underline">
              Early-payout Desk
            </Link>
            .
          </>
        }
      />

      <Tabs
        className="w-max self-start"
        activationMode="manual"
        value={sportScope}
        onValueChange={(value) => {
          if (value === "football" || value === "other") setSportScope(value);
        }}
      >
        <TabsList variant="segmented" aria-label="Sport" fadeClassName="from-page">
          <TabsTrigger value="football">Football</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>
      </Tabs>

      {sportScope === "football" ? (
        <div className={cn(panelSurface, "p-4")}>
          <div className={cn(sectionNestedTitle, "mb-1")}>Match (optional)</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Name the match and the profit tracker will link it - the windfall settles itself the
            moment your team goes two ahead and the result flips.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Home team</span>
              <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="e.g. Arsenal" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Away team</span>
              <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="e.g. Liverpool" />
            </label>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <span className="text-xs font-medium text-muted-foreground">Team you&apos;re backing</span>
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
      ) : null}

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
        title="Lay Bet"
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
            value={result?.layStake ?? 0}
            liability={result?.liability}
            pending={!result}
            onChange={(v) =>
              setLayStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
            }
          />
        </div>
      </LayPanel>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outcomes</CardTitle>
          <CardDescription>Windfall highlighted - the reason this offer is played.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(result?.scenarios ?? []).map((scenario) => (
            <div
              key={scenario.key}
              className={cn(
                "flex items-center justify-between rounded-md border px-3 py-2.5 text-sm",
                scenario.key === "windfall" && "border-success/30 bg-success/10 font-medium"
              )}
            >
              <span>
                {sportScope === "other"
                  ? scenario.key === "team_wins"
                    ? "Selection wins (lead paid or not)"
                    : scenario.key === "no_2up_no_win"
                      ? "Lead never pays and selection loses"
                      : "Lead pays, then selection loses (double payout)"
                  : scenario.label}
              </span>
              <MoneyFlow value={scenario.profit} signColor signDisplay className="font-semibold" />
            </div>
          ))}
        </CardContent>
      </Card>

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion:
            sportScope === "football"
              ? `${bookmaker ? bookmaker + " " : ""}2UP ${backedName || "back/lay"} @ ${backOdds}`
              : `${bookmaker ? bookmaker + " " : ""}Early payout ${backedName || "back/lay"} @ ${backOdds}`,
          betType: "qualifying",
          backStake,
          backOdds,
          layOdds,
          layStake: result?.layStake,
          exchangeId: exchange?.id,
          bookmaker: bookmaker || undefined,
          sport: sportScope === "football" ? "football" : undefined,
          homeTeam: sportScope === "football" ? homeTeam || undefined : undefined,
          awayTeam: sportScope === "football" ? awayTeam || undefined : undefined,
          market: sportScope === "football" ? "match_odds" : undefined,
          selection: sportScope === "football" ? backedSide : undefined,
          earlyPayout: true,
          expectedProfit: result ? Number(result.qualifyingLoss.toFixed(2)) : undefined,
        }}
      />
    </CalculatorShell>
  );
}
