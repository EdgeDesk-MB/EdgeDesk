"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow, PercentFlow } from "@/components/money-flow";
import { CalculatorShell } from "@/components/page-shell";
import { dutch, twoUpDutchScenarios } from "@/lib/calc";
import { Plus, Trash2 } from "lucide-react";

interface LegInput {
  label: string;
  odds: number;
}

export default function DutchingCalculatorPage() {
  return (
    <CalculatorShell wide>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dutching Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Split one total stake across every outcome for the same profit whatever happens -
          or run the 2UP dutch for early-payout windfalls.
        </p>
      </div>
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
  const [totalStake, setTotalStake] = useState(100);
  const [legs, setLegs] = useState<LegInput[]>([
    { label: "Home", odds: 2.5 },
    { label: "Draw", odds: 3.4 },
    { label: "Away", odds: 3.2 },
  ]);

  const result = useMemo(() => {
    if (totalStake <= 0 || legs.some((l) => !(l.odds > 1))) return null;
    return dutch(legs, totalStake);
  }, [legs, totalStake]);

  function updateLeg(index: number, patch: Partial<LegInput>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Outcomes</CardTitle>
          <CardDescription>Add every mutually exclusive outcome you&apos;re covering.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="max-w-xs">
            <NumField label="Total stake" prefix="£" value={totalStake} onChange={setTotalStake} min={0} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Outcome</TableHead>
                <TableHead className="w-32">Odds</TableHead>
                <TableHead className="w-32 text-right">Stake</TableHead>
                <TableHead className="w-32 text-right">Profit if wins</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {legs.map((leg, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input
                      value={leg.label}
                      onChange={(e) => updateLeg(i, { label: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step={0.01}
                      min={1.01}
                      className="tabular-nums"
                      value={leg.odds}
                      onChange={(e) => updateLeg(i, { odds: parseFloat(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyFlow value={result?.legs[i]?.stake ?? 0} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyFlow value={result?.legs[i]?.profitIfWins ?? 0} signColor signDisplay />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={legs.length <= 2}
                      onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setLegs((prev) => [...prev, { label: `Outcome ${prev.length + 1}`, odds: 3 }])}
          >
            <Plus className="size-4" /> Add outcome
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="grid grid-cols-3 gap-4 pt-6">
          <div>
            <div className="text-xs text-muted-foreground">Equal profit</div>
            <div className="text-2xl font-semibold">
              <MoneyFlow value={result?.profit ?? 0} signColor signDisplay />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Market overround</div>
            <div className="text-2xl font-semibold">
              <PercentFlow value={result?.overroundPct ?? 0} digits={2} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Your edge</div>
            <div className="text-2xl font-semibold">
              <PercentFlow value={result ? -result.overroundPct : 0} signColor digits={2} />
            </div>
          </div>
          <p className="col-span-3 text-[11px] text-muted-foreground">
            A negative overround means the combined prices imply less than 100% probability -
            a genuine arb. Anything positive is the margin you&apos;re paying for coverage.
          </p>
        </CardContent>
      </Card>

      {result && (
        <CalculatorAddBetButton
          className="self-start"
          prefill={{
            labelSuggestion: `Dutch · ${legs.map((l) => l.label).join(" / ")}`,
            dutchLegs: legs.map((l, i) => {
              const sel = l.label.toLowerCase();
              const selection =
                sel.includes("home") ? "home" : sel.includes("away") ? "away" : sel.includes("draw") ? "draw" : sel;
              return {
                label: l.label,
                market: "match_odds",
                selection,
                odds: l.odds,
                stake: result.legs[i]?.stake ?? 0,
              };
            }),
            expectedProfit: Number(result.profit.toFixed(2)),
          }}
        />
      )}
    </div>
  );
}

function TwoUpDutch() {
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Back both teams at 2UP bookies</CardTitle>
            <CardDescription>
              Both bookies pay out the moment their team goes two goals ahead.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <Input value={homeLabel} onChange={(e) => setHomeLabel(e.target.value)} />
              <Input value={awayLabel} onChange={(e) => setAwayLabel(e.target.value)} />
            </div>
            <NumField label="Home stake" prefix="£" value={homeStake} onChange={setHomeStake} min={0} />
            <NumField label="Home odds" value={homeOdds} onChange={setHomeOdds} min={1} />
            <NumField label="Away stake" prefix="£" value={awayStake} onChange={setAwayStake} min={0} />
            <NumField label="Away odds" value={awayOdds} onChange={setAwayOdds} min={1} />
          </CardContent>
        </Card>

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
                  className={
                    "flex items-center justify-between rounded-md border px-3 py-2 text-sm " +
                    (scenario.windfall ? "border-emerald-300 bg-emerald-50/60" : "")
                  }
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
