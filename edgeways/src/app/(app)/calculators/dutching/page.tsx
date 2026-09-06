"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { BackPanel, PanelInput, PanelTextInput } from "@/components/calc/bet-panels";
import { DutchOutcomesBuilder, inferMatchOddsSelection } from "@/components/calc/dutch-outcomes-builder";
import { MoneyFlow } from "@/components/money-flow";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { useExchanges } from "@/hooks/use-exchanges";
import { twoUpDutchScenarios, type DutchLeg, type DutchResult } from "@/lib/calc/dutching";
import { cn } from "@/lib/utils";

export default function DutchingCalculatorPage() {
  return (
    <CalculatorShell wide>
      <CalculatorPageHeader
        title="Dutching"
        description="Split a stake across outcomes, then round or override the suggested stakes."
      />
      <Tabs defaultValue="standard">
        <TabsList>
          <TabsTrigger value="standard">Standard dutch</TabsTrigger>
          <TabsTrigger value="twoup">2UP early payout dutch</TabsTrigger>
        </TabsList>
        <TabsContent value="standard" className="pt-4">
          <StandardDutch />
        </TabsContent>
        <TabsContent value="twoup" className="pt-4">
          <TwoUpDutch />
        </TabsContent>
      </Tabs>
    </CalculatorShell>
  );
}

function StandardDutch() {
  const [result, setResult] = useState<DutchResult | null>(null);
  const [legs, setLegs] = useState<Array<DutchLeg & { bookmaker?: string; freeBet?: "snr" | "sr" }>>([]);

  return (
    <div className="flex flex-col gap-6">
      <DutchOutcomesBuilder
        title="Outcomes"
        onResult={(r, l) => {
          setResult(r);
          setLegs(l);
        }}
      />

      {result && (
        <CalculatorAddBetButton
          className="self-start"
          prefill={{
            betType: "dutch",
            labelSuggestion: `Dutch · ${legs.map((l) => l.label).join(" / ")}`,
            dutchLegs: legs.map((l, i) => ({
              label: l.label,
              market: "match_odds",
              selection: inferMatchOddsSelection(l.label),
              odds: l.odds,
              stake: result.legs[i]?.stake ?? 0,
              bookmaker: l.bookmaker,
              freeBet: l.freeBet,
            })),
            expectedProfit: Number(result.profit.toFixed(2)),
          }}
        />
      )}
    </div>
  );
}

function TwoUpDutch() {
  const { defaultExchange } = useExchanges();
  const [homeLabel, setHomeLabel] = useState("Home team");
  const [awayLabel, setAwayLabel] = useState("Away team");
  const [homeStake, setHomeStake] = useState(50);
  const [homeOdds, setHomeOdds] = useState(2.2);
  const [awayStake, setAwayStake] = useState(40);
  const [awayOdds, setAwayOdds] = useState(2.75);

  const scenarios = useMemo(() => {
    if (!(homeStake > 0 && awayStake > 0 && homeOdds > 1 && awayOdds > 1)) return null;
    return twoUpDutchScenarios({ homeStake, homeOdds, awayStake, awayOdds });
  }, [homeStake, homeOdds, awayStake, awayOdds]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <BackPanel title="Back both teams at 2UP bookies" exchange={defaultExchange}>
          <p className="text-xs text-black/60 dark:text-white/70">
            Both bookies pay out the moment their team goes two goals ahead.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PanelTextInput label="Home team" value={homeLabel} onChange={setHomeLabel} />
            <PanelTextInput label="Away team" value={awayLabel} onChange={setAwayLabel} />
            <PanelInput label="Home stake" prefix="£" value={homeStake} onChange={setHomeStake} min={0} />
            <PanelInput label="Home odds" value={homeOdds} onChange={setHomeOdds} min={1} exchangeOddsStepping />
            <PanelInput label="Away stake" prefix="£" value={awayStake} onChange={setAwayStake} min={0} />
            <PanelInput label="Away odds" value={awayOdds} onChange={setAwayOdds} min={1} exchangeOddsStepping />
          </div>
        </BackPanel>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenario matrix</CardTitle>
            <CardDescription>Windfalls highlighted - the reason this offer is played.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {(scenarios ?? []).map((scenario) => (
                <div
                  key={scenario.label}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
                    scenario.windfall && "border-success/30 bg-success/10"
                  )}
                >
                  <span className={scenario.windfall ? "font-medium" : ""}>{scenario.label}</span>
                  <MoneyFlow value={scenario.profit} signColor signDisplay className="font-semibold" />
                </div>
              ))}
            </div>
            <CalculatorAddBetButton
              disabled={!scenarios}
              className="mt-4"
              prefill={{
                betType: "dutch",
                labelSuggestion: `2UP dutch: ${homeLabel} / ${awayLabel}`,
                homeTeam: homeLabel,
                awayTeam: awayLabel,
                dutchLegs: [
                  { label: homeLabel, market: "match_odds", selection: "home", odds: homeOdds, stake: homeStake, earlyPayout: true },
                  { label: awayLabel, market: "match_odds", selection: "away", odds: awayOdds, stake: awayStake, earlyPayout: true },
                ],
                expectedProfit: scenarios ? Number(scenarios[0].profit.toFixed(2)) : undefined,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
