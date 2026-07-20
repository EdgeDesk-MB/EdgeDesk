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
import { VenueSelect } from "@/components/venue-select";
import { bookieFreeBetBalance } from "@/components/add-bet/back-bookie-balance-strip";
import { useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  dutch,
  dutchStakeForLegStake,
  dutchStakeForProfit,
  dutchStakesForFreeLeg,
  type DutchLeg,
  type DutchResult,
} from "@/lib/calc";
import { cn } from "@/lib/utils";
import { Gift, Plus, Trash2 } from "lucide-react";

export type DutchStakeMode = "total" | "profit" | "leg";

/** A leg as edited in the builder - bookmaker/exchange and an optional
 * free-bet flag on top of the pure calc leg (label + odds). */
export type BuilderLeg = DutchLeg & { bookmaker?: string; freeBet?: "snr" | "sr" };

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

const DEFAULT_LEGS: BuilderLeg[] = [
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
  /** Seeds the table once on mount - e.g. legs parsed from an existing bet.
   * `stake` (the leg's originally-saved stake) is only used to restore the
   * right mode/inputs on mount - it isn't tracked as ongoing state. */
  initialLegs?: Array<BuilderLeg & { stake?: number }>;
  /** Fires whenever the computed result changes; null while inputs are incomplete. */
  onResult: (result: DutchResult | null, legs: BuilderLeg[]) => void;
  title?: string;
  minLegs?: number;
  maxLegs?: number;
  className?: string;
}) {
  const [legs, setLegs] = useState<BuilderLeg[]>(() =>
    initialLegs && initialLegs.length >= minLegs
      ? initialLegs.map(({ stake: _stake, ...l }) => l)
      : DEFAULT_LEGS
  );
  // A saved free-bet leg must restore into "First outcome" mode with its
  // original stake/venue - otherwise reopening the bet silently falls back to
  // Total-stake-£100 and saving would convert the free leg into fake cash.
  const initialFreeLegIndex = initialLegs?.findIndex((l) => l.freeBet) ?? -1;
  const [mode, setMode] = useState<DutchStakeMode>(() => (initialFreeLegIndex >= 0 ? "leg" : "total"));
  const [totalStakeInput, setTotalStakeInput] = useState(() => {
    if (initialFreeLegIndex >= 0 || !initialLegs?.length) return 100;
    const sum = initialLegs.reduce((a, l) => a + (l.stake ?? 0), 0);
    return sum > 0 ? sum : 100;
  });
  const [targetProfitInput, setTargetProfitInput] = useState(10);
  const [fixedLegIndex, setFixedLegIndex] = useState(() => (initialFreeLegIndex >= 0 ? initialFreeLegIndex : 0));
  const [fixedLegStakeInput, setFixedLegStakeInput] = useState(() =>
    initialFreeLegIndex >= 0 ? (initialLegs![initialFreeLegIndex].stake ?? 40) : 40
  );
  /** Only meaningful in "First outcome" mode - the fixed leg's stake is a
   * free bet rather than real cash. Reset whenever the fixed leg changes so
   * the flag never silently follows the selector to a different outcome. */
  const [freeBetType, setFreeBetType] = useState<"snr" | "sr" | null>(() =>
    initialFreeLegIndex >= 0 ? (initialLegs![initialFreeLegIndex].freeBet ?? null) : null
  );

  const { defaultExchange } = useExchanges();
  const { state: appState } = useAppState();

  const legsValid = legs.length >= minLegs && legs.every((l) => l.odds > 1);
  const safeFixedIndex = Math.min(fixedLegIndex, legs.length - 1);
  const freeLegActive = mode === "leg" && freeBetType != null;

  // Memoized so `result` only gets a NEW reference when an input actually
  // changes - dutch()/the ternary chain otherwise return a fresh object on
  // every render, which would retrigger the effect below every render and
  // loop forever (setResult in the parent -> re-render -> new object -> ...).
  const totalStake = useMemo(() => {
    if (!legsValid || freeLegActive) return null;
    if (mode === "total") return totalStakeInput > 0 ? totalStakeInput : null;
    if (mode === "profit") return dutchStakeForProfit(legs, targetProfitInput);
    return dutchStakeForLegStake(legs, safeFixedIndex, fixedLegStakeInput);
  }, [legsValid, freeLegActive, mode, totalStakeInput, targetProfitInput, legs, safeFixedIndex, fixedLegStakeInput]);

  const result = useMemo(() => {
    if (!legsValid) return null;
    if (freeLegActive) {
      return dutchStakesForFreeLeg(legs, safeFixedIndex, fixedLegStakeInput, freeBetType!);
    }
    return totalStake != null && totalStake > 0 ? dutch(legs, totalStake) : null;
  }, [legsValid, freeLegActive, legs, safeFixedIndex, fixedLegStakeInput, freeBetType, totalStake]);

  // legs annotated with the free-bet flag on the fixed leg only, for the
  // parent to persist alongside each leg's stake/bookmaker.
  const outputLegs = useMemo(
    () =>
      legs.map((l, i) => ({
        ...l,
        freeBet: freeLegActive && i === safeFixedIndex ? freeBetType! : undefined,
      })),
    [legs, freeLegActive, safeFixedIndex, freeBetType]
  );

  useEffect(() => {
    onResult(result, outputLegs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, outputLegs]);

  function updateLeg(index: number, patch: Partial<BuilderLeg>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function changeFixedLeg(index: number) {
    setFixedLegIndex(index);
    setFreeBetType(null);
  }

  const fixedLegVenue = legs[safeFixedIndex]?.bookmaker ?? "";
  const fixedLegFreeBets = bookieFreeBetBalance(appState?.balances?.accounts, fixedLegVenue);

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
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">
                Fix stake on
              </span>
              <select
                value={safeFixedIndex}
                onChange={(e) => changeFixedLeg(Number(e.target.value))}
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
              label={freeBetType ? "Free bet stake" : "Its stake"}
              prefix="£"
              value={fixedLegStakeInput}
              onChange={setFixedLegStakeInput}
              min={0}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFreeBetType(freeBetType ? null : "snr")}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold",
                freeBetType
                  ? "bg-violet-600/20 text-violet-950 dark:bg-violet-500/25 dark:text-violet-100"
                  : "bg-[var(--pi)] text-black/70 dark:bg-[var(--pi-dark)] dark:text-white/80"
              )}
            >
              <Gift className="size-3.5" aria-hidden />
              Free bet
            </button>
            {freeBetType ? (
              <>
                <div className="flex h-8 overflow-hidden rounded-md text-xs font-semibold">
                  {(["snr", "sr"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFreeBetType(t)}
                      className={cn(
                        "h-full px-2.5",
                        freeBetType === t
                          ? "bg-violet-600/25 text-violet-950 dark:bg-violet-500/30 dark:text-violet-100"
                          : "bg-[var(--pi)] text-black/60 dark:bg-[var(--pi-dark)] dark:text-white/70"
                      )}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                {fixedLegVenue ? (
                  fixedLegFreeBets > 0.001 ? (
                    <button
                      type="button"
                      onClick={() => setFixedLegStakeInput(fixedLegFreeBets)}
                      className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-900 dark:text-violet-200"
                    >
                      Use £{fixedLegFreeBets.toFixed(2)} available
                    </button>
                  ) : (
                    <span className="text-[11px] text-black/50 dark:text-white/50">
                      No free bet balance tracked for {fixedLegVenue}
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-black/50 dark:text-white/50">
                    Pick a venue below to see its free bet balance
                  </span>
                )}
              </>
            ) : null}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        {legs.map((leg, i) => {
          const legResult = result?.legs[i];
          const isFreeLeg = freeLegActive && i === safeFixedIndex;
          return (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg bg-black/5 p-2.5 dark:bg-white/5"
            >
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <PanelTextInput
                    label="Outcome"
                    value={leg.label}
                    onChange={(v) => updateLeg(i, { label: v })}
                    placeholder={`Outcome ${i + 1}`}
                    inputClassName="h-10 text-sm"
                  />
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
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">
                    Venue
                  </span>
                  <VenueSelect
                    compact
                    value={leg.bookmaker ?? ""}
                    onChange={(v) => updateLeg(i, { bookmaker: v })}
                  />
                </div>
                <PanelInput
                  label="Odds"
                  value={leg.odds}
                  onChange={(v) => updateLeg(i, { odds: v })}
                  min={1.01}
                  step={0.01}
                  inputClassName="h-10 text-sm"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">
                    Stake
                  </span>
                  <div className="flex h-10 items-center gap-1 rounded-md bg-[var(--pi)] px-2.5 dark:bg-[var(--pi-dark)]">
                    {isFreeLeg ? (
                      <Gift className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                    ) : null}
                    <span className="truncate text-sm font-bold tabular-nums text-black/85 dark:text-white/95">
                      <MoneyFlow value={legResult?.stake ?? 0} />
                    </span>
                  </div>
                </div>
              </div>
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
            {freeLegActive ? "Cash outlay" : "Total stake"}
          </div>
          <div className="text-lg font-bold tabular-nums">
            <MoneyFlow
              value={freeLegActive ? (result?.totalStake ?? 0) - fixedLegStakeInput : (result?.totalStake ?? 0)}
            />
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
