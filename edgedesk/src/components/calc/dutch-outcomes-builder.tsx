"use client";

/**
 * Shared "build a dutch" block - the outcomes table plus the three stake-entry
 * modes (Total stake / Target profit / First outcome). Mounted by BOTH the
 * standalone Dutching calculator and Add bet's Dutch type, so behaviour and
 * styling never drift between the two entry points.
 *
 * Self-contained: owns its legs/mode state locally and only surfaces the
 * computed DutchResult (plus the raw label/odds legs) via `onResult` - the
 * parent decides what to do with it (calculator preview vs a bet payload).
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackPanel, PanelInput, PanelTextInput } from "@/components/calc/bet-panels";
import { MoneyFlow, PercentFlow } from "@/components/money-flow";
import { useExchanges } from "@/hooks/use-exchanges";
import { dutch, dutchStakeForLegStake, dutchStakeForProfit, type DutchLeg, type DutchResult } from "@/lib/calc";
import { Plus, Trash2 } from "lucide-react";

export type DutchStakeMode = "total" | "profit" | "leg";

/** Match-odds legs are auto-derived home/draw/away by label text so a dutch
 * bet settles automatically against a linked football event. Shared by the
 * Dutching calculator and Add bet's Dutch type - one mapping, used everywhere
 * a DutchOutcomesBuilder result becomes a stored leg. */
export function inferMatchOddsSelection(label: string): string {
  const sel = label.toLowerCase();
  if (sel.includes("home")) return "home";
  if (sel.includes("away")) return "away";
  if (sel.includes("draw")) return "draw";
  return sel;
}

const DEFAULT_LEGS: DutchLeg[] = [
  { label: "Home", odds: 2.5 },
  { label: "Draw", odds: 3.4 },
  { label: "Away", odds: 3.2 },
];

export function DutchOutcomesBuilder({
  initialLegs,
  onResult,
  title = "Outcomes",
  minLegs = 2,
  maxLegs = 12,
  className,
}: {
  /** Seeds the table once on mount - e.g. legs parsed from an existing bet. */
  initialLegs?: DutchLeg[];
  /** Fires whenever the computed result changes; null while inputs are incomplete. */
  onResult: (result: DutchResult | null, legs: DutchLeg[]) => void;
  title?: string;
  minLegs?: number;
  maxLegs?: number;
  className?: string;
}) {
  const [legs, setLegs] = useState<DutchLeg[]>(() =>
    initialLegs && initialLegs.length >= minLegs ? initialLegs : DEFAULT_LEGS
  );
  const [mode, setMode] = useState<DutchStakeMode>("total");
  const [totalStakeInput, setTotalStakeInput] = useState(100);
  const [targetProfitInput, setTargetProfitInput] = useState(10);
  const [fixedLegIndex, setFixedLegIndex] = useState(0);
  const [fixedLegStakeInput, setFixedLegStakeInput] = useState(40);

  const { defaultExchange } = useExchanges();

  const legsValid = legs.length >= minLegs && legs.every((l) => l.odds > 1);
  const safeFixedIndex = Math.min(fixedLegIndex, legs.length - 1);

  // Memoized so `result` only gets a NEW reference when an input actually
  // changes - dutch()/the ternary chain otherwise return a fresh object on
  // every render, which would retrigger the effect below every render and
  // loop forever (setResult in the parent -> re-render -> new object -> ...).
  const totalStake = useMemo(() => {
    if (!legsValid) return null;
    if (mode === "total") return totalStakeInput > 0 ? totalStakeInput : null;
    if (mode === "profit") return dutchStakeForProfit(legs, targetProfitInput);
    return dutchStakeForLegStake(legs, safeFixedIndex, fixedLegStakeInput);
  }, [legsValid, mode, totalStakeInput, targetProfitInput, legs, safeFixedIndex, fixedLegStakeInput]);

  const result = useMemo(
    () => (totalStake != null && totalStake > 0 ? dutch(legs, totalStake) : null),
    [legs, totalStake]
  );

  useEffect(() => {
    onResult(result, legs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, legs]);

  function updateLeg(index: number, patch: Partial<DutchLeg>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  return (
    <BackPanel title={title} exchange={defaultExchange} className={className}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as DutchStakeMode)}>
        <TabsList variant="segmented">
          <TabsTrigger value="total">Total stake</TabsTrigger>
          <TabsTrigger value="profit">Target profit</TabsTrigger>
          <TabsTrigger value="leg">First outcome</TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "total" ? (
        <PanelInput label="Total stake" prefix="£" value={totalStakeInput} onChange={setTotalStakeInput} min={0} />
      ) : mode === "profit" ? (
        <>
          <PanelInput
            label="Target equal profit"
            prefix="£"
            value={targetProfitInput}
            onChange={setTargetProfitInput}
          />
          {legsValid && totalStake == null ? (
            <p className="text-xs font-medium text-black/70 dark:text-white/70">
              Not achievable at these odds - the market doesn&apos;t allow a guaranteed profit.
            </p>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">
              Fix stake on
            </span>
            <select
              value={safeFixedIndex}
              onChange={(e) => setFixedLegIndex(Number(e.target.value))}
              className="h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-sm font-semibold text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-[var(--pi-dark)] dark:text-white/95"
            >
              {legs.map((l, i) => (
                <option key={i} value={i}>
                  {l.label || `Outcome ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
          <PanelInput
            label="Its stake"
            prefix="£"
            value={fixedLegStakeInput}
            onChange={setFixedLegStakeInput}
            min={0}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        {legs.map((leg, i) => {
          const legResult = result?.legs[i];
          return (
            <div key={i} className="flex items-end gap-2">
              <PanelTextInput
                label={i === 0 ? "Outcome" : ""}
                value={leg.label}
                onChange={(v) => updateLeg(i, { label: v })}
                placeholder={`Outcome ${i + 1}`}
                inputClassName="h-10 text-sm"
              />
              <PanelInput
                label={i === 0 ? "Odds" : ""}
                value={leg.odds}
                onChange={(v) => updateLeg(i, { odds: v })}
                min={1.01}
                step={0.01}
                inputClassName="h-10 w-24 text-sm"
              />
              <div className="flex h-10 w-28 shrink-0 flex-col items-end justify-center">
                <span className="text-sm font-bold tabular-nums text-black/85 dark:text-white/95">
                  <MoneyFlow value={legResult?.stake ?? 0} />
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-black/50 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
                disabled={legs.length <= minLegs}
                onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove outcome ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-black/15 bg-black/5 text-black/80 hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15"
          disabled={legs.length >= maxLegs}
          onClick={() => setLegs((prev) => [...prev, { label: `Outcome ${prev.length + 1}`, odds: 3 }])}
        >
          <Plus className="size-4" /> Add outcome
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Equal profit
          </div>
          <div className="text-lg font-bold">
            <MoneyFlow value={result?.profit ?? 0} signColor signDisplay />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Total stake
          </div>
          <div className="text-lg font-bold tabular-nums">
            <MoneyFlow value={result?.totalStake ?? 0} />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Overround
          </div>
          <div className="text-lg font-bold">
            <PercentFlow value={result?.overroundPct ?? 0} digits={2} />
          </div>
        </div>
      </div>
    </BackPanel>
  );
}
