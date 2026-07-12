"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow } from "@/components/money-flow";
import { exchangeOddsStepHandlers } from "@/lib/calc/exchange-odds-step";
import { CalculatorShell } from "@/components/page-shell";
import {
  accaMatched,
  isLuckyLayMatrixType,
  luckyLayMatrix,
  requiredLegCount,
  type AccaLeg,
  type AccaStructureType,
} from "@/lib/calc";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";

const STANDARD_TYPES: AccaStructureType[] = ["double", "treble", "four_fold"];
const FULL_COVER_TYPES: AccaStructureType[] = [
  "trixie",
  "patent",
  "yankee",
  "lucky_15",
  "lucky_31",
  "lucky_63",
];

const TYPE_LABELS: Record<AccaStructureType, string> = {
  double: "Double",
  treble: "Treble",
  four_fold: "Four-fold",
  trixie: "Trixie",
  patent: "Patent",
  yankee: "Yankee",
  lucky_15: "Lucky 15",
  lucky_31: "Lucky 31",
  lucky_63: "Lucky 63",
};

function emptyLegs(count: number): AccaLeg[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `Leg ${i + 1}`,
    backOdds: 2,
    layOdds: 2.02,
  }));
}

function AccaCalculator({ mode }: { mode: "standard" | "full_cover" }) {
  const types = mode === "standard" ? STANDARD_TYPES : FULL_COVER_TYPES;
  const [betType, setBetType] = useState<AccaStructureType>(types[0]);
  const [unitStake, setUnitStake] = useState(10);
  const [commission, setCommission] = useState(2);
  const legCount = requiredLegCount(betType);
  const [legs, setLegs] = useState<AccaLeg[]>(() => emptyLegs(legCount));

  useEffect(() => {
    const n = requiredLegCount(betType);
    setLegs((prev) => {
      if (prev.length === n) return prev;
      return emptyLegs(n).map((leg, i) => prev[i] ?? leg);
    });
  }, [betType]);

  const result = useMemo(() => {
    if (unitStake <= 0) return null;
    return accaMatched(betType, unitStake, legs, commission / 100);
  }, [betType, unitStake, legs, commission]);

  const layMatrix = useMemo(() => {
    if (mode !== "full_cover" || !isLuckyLayMatrixType(betType)) return null;
    return luckyLayMatrix(betType, unitStake, legs, commission / 100);
  }, [mode, betType, unitStake, legs, commission]);

  const isSingleMulti = STANDARD_TYPES.includes(betType);
  const showLayOdds = isSingleMulti || isLuckyLayMatrixType(betType);

  function updateLeg(index: number, patch: Partial<AccaLeg>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Structure</CardTitle>
          <CardDescription>
            {mode === "standard"
              ? "Single accumulator - layered lay stakes on each leg."
              : "Full-cover bets - unit stake is per constituent bet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Bet type</span>
              <Select value={betType} onValueChange={(v) => setBetType(v as AccaStructureType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]} ({requiredLegCount(t)} legs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumField
              label={mode === "standard" ? "Back stake" : "Unit stake (per bet)"}
              prefix="£"
              value={unitStake}
              onChange={setUnitStake}
              min={0}
            />
            {isSingleMulti && (
              <NumField
                label="Lay commission (%)"
                value={commission}
                onChange={setCommission}
                min={0}
                step={0.5}
              />
            )}
            {mode === "full_cover" && isLuckyLayMatrixType(betType) && (
              <NumField
                label="Lay commission (%)"
                value={commission}
                onChange={setCommission}
                min={0}
                step={0.5}
              />
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Selection</TableHead>
                <TableHead className="w-28">Back odds</TableHead>
                {showLayOdds && <TableHead className="w-28">Lay odds</TableHead>}
                {isSingleMulti && result && (
                  <TableHead className="w-28 text-right">Lay stake</TableHead>
                )}
                {layMatrix && (
                  <TableHead className="w-28 text-right">Lay stake</TableHead>
                )}
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
                      step="0.01"
                      min={1}
                      value={leg.backOdds}
                      onChange={(e) => updateLeg(i, { backOdds: parseFloat(e.target.value) })}
                    />
                  </TableCell>
                  {showLayOdds && (
                    <>
                      <TableCell>
                        {(() => {
                          const layOddsStep = exchangeOddsStepHandlers(
                            leg.layOdds ?? NaN,
                            (layOdds) => updateLeg(i, { layOdds })
                          );
                          return (
                        <Input
                          type="number"
                          step="0.01"
                          min={1}
                          value={leg.layOdds ?? ""}
                          onChange={(e) => updateLeg(i, { layOdds: parseFloat(e.target.value) })}
                          onKeyDown={layOddsStep.onKeyDown}
                          onWheel={layOddsStep.onWheel}
                        />
                          );
                        })()}
                      </TableCell>
                      {isSingleMulti && (
                        <TableCell className="text-right tabular-nums">
                          {result?.layerLays[i] ? (
                            <MoneyFlow value={result.layerLays[i].layStake} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                      {layMatrix && (
                        <TableCell className="text-right tabular-nums">
                          {layMatrix.lays[i] ? (
                            <MoneyFlow value={layMatrix.lays[i].layStake} />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Returns</CardTitle>
            <CardDescription>
              {result.structure.betCount} bets · total stake{" "}
              <MoneyFlow value={result.structure.totalStake} className="font-semibold" />
              {result.structure.profitIfAllWin !== 0 && (
                <>
                  {" "}
                  · if all win{" "}
                  <MoneyFlow value={result.structure.profitIfAllWin} className="font-semibold" />
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!isSingleMulti && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Combination</TableHead>
                    <TableHead className="text-right">Odds</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.structure.combinations.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        {c.legs.map((idx) => legs[idx]?.label ?? `Leg ${idx + 1}`).join(" + ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.combinedBackOdds.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <MoneyFlow value={c.return} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {result.scenarios && result.scenarios.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.scenarios.map((s) => (
                    <TableRow key={s.label}>
                      <TableCell>{s.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <MoneyFlow value={s.profit} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {layMatrix && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Lay matrix</CardTitle>
                  <CardDescription>
                    All leg win/loss combinations - total lay stake{" "}
                    <MoneyFlow
                      value={layMatrix.lays.reduce((a, l) => a + l.layStake, 0)}
                      className="font-semibold"
                    />
                    {" · "}
                    worst case{" "}
                    <MoneyFlow
                      value={Math.min(...layMatrix.matrix.map((m) => m.profit))}
                      className="font-semibold"
                    />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-auto rounded-lg border border-border/80">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className={tableHeaderCell}>Outcome</TableHead>
                          <TableHead className={`${tableHeaderCell} text-right`}>P&amp;L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {layMatrix.matrix.map((row) => (
                          <TableRow key={row.label}>
                            <TableCell className={`${tableBodyCell} text-xs`}>{row.label}</TableCell>
                            <TableCell className={`${tableBodyCell} text-right tabular-nums`}>
                              <MoneyFlow value={row.profit} signColor />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {isSingleMulti && result.totalLayStake > 0 && (
              <p className="text-sm text-muted-foreground">
                Total lay stake{" "}
                <MoneyFlow value={result.totalLayStake} className="font-semibold" /> · liability{" "}
                <MoneyFlow value={result.totalLiability} className="font-semibold" /> · worst case{" "}
                <MoneyFlow value={result.worstCase} className="font-semibold" />
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${TYPE_LABELS[betType]} · ${legs.map((l) => l.label).join(" / ")}`,
          betType: "qualifying",
          backStake: result?.structure.totalStake ?? unitStake,
          backOdds:
            result && result.structure.totalStake > 0
              ? result.structure.returnIfAllWin / result.structure.totalStake
              : 2,
          layOdds: 1.01,
          layStake: 0,
          expectedProfit: result ? Number(result.worstCase.toFixed(2)) : undefined,
        }}
      />
    </div>
  );
}

export default function AccumulatorCalculatorPage() {
  return (
    <CalculatorShell wide>
      <CalculatorPageHeader
        title="Accumulator Calculator"
        description="Doubles through Lucky 63 - back returns for full-cover bets and layered lays for standard accumulators."
      />
      <Tabs defaultValue="standard">
        <TabsList>
          <TabsTrigger value="standard">Standard acca</TabsTrigger>
          <TabsTrigger value="full_cover">Full cover</TabsTrigger>
        </TabsList>
        <TabsContent value="standard" className="pt-4">
          <AccaCalculator mode="standard" />
        </TabsContent>
        <TabsContent value="full_cover" className="pt-4">
          <AccaCalculator mode="full_cover" />
        </TabsContent>
      </Tabs>
    </CalculatorShell>
  );
}
