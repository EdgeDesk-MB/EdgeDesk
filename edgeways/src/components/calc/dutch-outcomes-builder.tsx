"use client";

/**
 * Shared "build a dutch" block - the outcomes table plus the three stake-entry
 * modes (Total stake / Target profit / First outcome), plus execution rounding
 * and per-leg stake overrides. Mounted by BOTH the standalone Dutching
 * calculator and Add bet's Dutch type, so behaviour and styling never drift.
 *
 * Self-contained: owns its legs/mode state locally and only surfaces the
 * computed DutchResult (plus the raw label/odds legs) via `onResult` - the
 * parent decides what to do with it (calculator preview vs a bet payload).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNonPassiveWheel } from "@/hooks/use-non-passive-wheel";
import { Button } from "@/components/ui/button";
import { NumberStepperButtons } from "@/components/ui/number-stepper-buttons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PANEL_TINT_TRANSITION,
  PanelInput,
  PanelSelect,
  PanelTextInput,
  useSettledPanelTint,
} from "@/components/calc/bet-panels";
import { MoneyFlow, PercentFlow } from "@/components/money-flow";
import { VenueSelect } from "@/components/venue-select";
import { bookieFreeBetBalance } from "@/components/add-bet/back-bookie-balance-strip";
import { panelTintVars } from "@/lib/brands/exchanges";
import { resolveBackPlateColors } from "@/lib/brands/panel-tints";
import { useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  DUTCH_END_BIAS_CENTER,
  DUTCH_STAKE_INCREMENTS,
  applyDutchEndBias,
  dutch,
  dutchEndBias,
  dutchStakeForLegStake,
  dutchStakeForProfit,
  dutchStakesForFreeLeg,
  formatDutchStakeIncrement,
  realiseDutch,
  type DutchLeg,
  type DutchResult,
} from "@/lib/calc";
import { formatMoneyAmount } from "@/lib/format-money";
import { roundPence, stepByIncrement } from "@/lib/calc/money";
import {
  campaignHeaderBand,
  fieldControlShadow,
  panelSurface,
  toolbarSelectTrigger,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ChevronDown, Gift, Plus, X } from "lucide-react";

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
  const tintReady = useSettledPanelTint();
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
  const [roundTo, setRoundTo] = useState<(typeof DUTCH_STAKE_INCREMENTS)[number]>(0.01);
  const [overrides, setOverrides] = useState<Array<number | null>>(() =>
    (initialLegs ?? []).map((l) => (l.stake != null && l.stake > 0 ? l.stake : null))
  );
  const [dragBias, setDragBias] = useState<number | null>(null);
  const dragBiasRef = useRef<number | null>(null);

  const { defaultExchange } = useExchanges();
  const { state: appState } = useAppState();

  const legsValid = legs.length >= minLegs && legs.every((l) => l.odds > 1);
  const safeFixedIndex = Math.min(fixedLegIndex, legs.length - 1);
  const freeLegActive = mode === "leg" && freeBetType != null;
  const lastIndex = legs.length - 1;
  const lockFirst = mode === "leg" && safeFixedIndex === 0;
  const lockLast = mode === "leg" && lastIndex > 0 && safeFixedIndex === lastIndex;

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

  const ideal = useMemo(() => {
    if (!legsValid) return null;
    if (freeLegActive) {
      return dutchStakesForFreeLeg(legs, safeFixedIndex, fixedLegStakeInput, freeBetType!);
    }
    return totalStake != null && totalStake > 0 ? dutch(legs, totalStake) : null;
  }, [legsValid, freeLegActive, legs, safeFixedIndex, fixedLegStakeInput, freeBetType, totalStake]);

  const preserveExact = useMemo(() => {
    if (mode !== "leg") return [];
    return [safeFixedIndex];
  }, [mode, safeFixedIndex]);

  const suggested = useMemo(
    () =>
      ideal
        ? realiseDutch(ideal, {
            roundTo,
            preserveExact,
            freeLeg: freeLegActive ? { index: safeFixedIndex, type: freeBetType! } : undefined,
          })
        : null,
    [ideal, roundTo, preserveExact, freeLegActive, safeFixedIndex, freeBetType]
  );

  const result = useMemo(
    () =>
      ideal
        ? realiseDutch(ideal, {
            roundTo,
            preserveExact,
            overrides,
            freeLeg: freeLegActive ? { index: safeFixedIndex, type: freeBetType! } : undefined,
          })
        : null,
    [ideal, roundTo, preserveExact, overrides, freeLegActive, safeFixedIndex, freeBetType]
  );

  const derivedBias = useMemo(() => {
    if (!suggested || !result || suggested.legs.length < 2) return DUTCH_END_BIAS_CENTER;
    return dutchEndBias(
      suggested.legs.map((leg) => leg.stake),
      result.legs.map((leg) => leg.stake)
    );
  }, [suggested, result]);
  const shownBias = dragBias ?? derivedBias;

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

  function setLegOverride(index: number, stake: number | null) {
    setOverrides((prev) => {
      const next = Array.from({ length: Math.max(prev.length, index + 1) }, (_, i) => prev[i] ?? null);
      next[index] = stake;
      return next;
    });
  }

  function isCustomStake(index: number): boolean {
    const override = overrides[index];
    const idealStake = suggested?.legs[index]?.stake;
    if (override == null || !Number.isFinite(override) || idealStake == null) return false;
    return roundPence(override) !== roundPence(idealStake);
  }

  function applyEndBias(raw: number, snap: boolean) {
    if (!suggested || !result || lastIndex < 1) return;
    const value =
      snap && Math.abs(raw - DUTCH_END_BIAS_CENTER) < 0.03 ? DUTCH_END_BIAS_CENTER : raw;
    if (value === DUTCH_END_BIAS_CENTER) {
      setOverrides((prev) => {
        const next = Array.from({ length: legs.length }, (_, i) => prev[i] ?? null);
        if (!lockFirst) next[0] = null;
        if (!lockLast) next[lastIndex] = null;
        return next;
      });
      return;
    }
    const nextStakes = applyDutchEndBias(
      suggested.legs.map((leg) => leg.stake),
      result.legs.map((leg) => leg.stake),
      value,
      { lockFirst, lockLast }
    );
    setOverrides((prev) => {
      const next = Array.from({ length: legs.length }, (_, i) => prev[i] ?? null);
      if (!lockFirst) next[0] = nextStakes[0];
      if (!lockLast) next[lastIndex] = nextStakes[lastIndex];
      return next;
    });
  }

  function onBiasInput(raw: number) {
    dragBiasRef.current = raw;
    setDragBias(raw);
    applyEndBias(raw, false);
  }

  function endBiasDrag() {
    const raw = dragBiasRef.current;
    if (raw != null) applyEndBias(raw, true);
    dragBiasRef.current = null;
    setDragBias(null);
  }

  function changeFixedLeg(index: number) {
    setFixedLegIndex(index);
    setFreeBetType(null);
  }

  const fixedLegVenue = legs[safeFixedIndex]?.bookmaker ?? "";
  const fixedLegFreeBets = bookieFreeBetBalance(appState?.balances?.accounts, fixedLegVenue);

  return (
    // Plain neutral shell (matches the "Campaign P&L" header band, see
    // `campaignHeaderBand`) - the account-default tint now applies per
    // outcome box below, not to this shared shell, so a leg's own bookie
    // tint can stand apart from its siblings.
    <div className={cn(panelSurface, className)}>
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/50 px-4 py-2.5",
          campaignHeaderBand
        )}
      >
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as DutchStakeMode)}
          activationMode="manual"
        >
          <TabsList variant="segmented">
            <TabsTrigger value="total">Total stake</TabsTrigger>
            <TabsTrigger value="profit">Target profit</TabsTrigger>
            <TabsTrigger value="leg">First outcome</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select
          value={String(roundTo)}
          onValueChange={(v) => {
            const next = DUTCH_STAKE_INCREMENTS.find((inc) => String(inc) === v);
            if (next != null) setRoundTo(next);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Round stakes to"
            className={cn(toolbarSelectTrigger, "h-8")}
          >
            <span className="text-muted-foreground">Round to</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUTCH_STAKE_INCREMENTS.map((inc) => (
              <SelectItem key={inc} value={String(inc)}>
                {formatDutchStakeIncrement(inc)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "total" ? (
        <PanelInput
          label="Total stake"
          prefix="£"
          value={totalStakeInput}
          onChange={setTotalStakeInput}
          min={0}
          incrementStepping={roundTo}
          inputClassName="bg-muted dark:bg-muted"
        />
      ) : mode === "profit" ? (
        <>
          <PanelInput
            label="Target equal profit"
            prefix="£"
            value={targetProfitInput}
            onChange={setTargetProfitInput}
            inputClassName="bg-muted dark:bg-muted"
          />
          {legsValid && totalStake == null ? (
            <p className="text-xs font-medium text-muted-foreground">
              Not achievable at these odds - a fair book needs an infinite stake.
            </p>
          ) : mode === "profit" && result && result.profit < -0.005 && targetProfitInput > 0 ? (
            <p className="text-xs font-medium text-muted-foreground">
              Overround book, these stakes equalise at a loss of{" "}
              <MoneyFlow value={Math.abs(result.profit)} className="inline font-semibold" />
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <PanelSelect
              label="Fix stake on"
              value={String(safeFixedIndex)}
              onChange={(v) => changeFixedLeg(Number(v))}
              selectClassName="h-11 bg-muted text-sm font-semibold dark:bg-muted"
            >
              {legs.map((l, i) => (
                <option key={i} value={i}>
                  {l.label || `Outcome ${i + 1}`}
                </option>
              ))}
            </PanelSelect>
            <PanelInput
              label={freeBetType ? "Free bet stake" : "Its stake"}
              prefix="£"
              value={fixedLegStakeInput}
              onChange={setFixedLegStakeInput}
              min={0}
              incrementStepping={roundTo}
              inputClassName="bg-muted dark:bg-muted"
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
                  : "bg-muted text-muted-foreground"
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
                          : "bg-muted text-muted-foreground"
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
                      className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-900 dark:text-violet-200"
                    >
                      Use £{fixedLegFreeBets.toFixed(2)} available
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No free bet balance tracked for {fixedLegVenue}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">
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
          const isScaleLeg = mode === "leg" && i === safeFixedIndex && !freeLegActive;
          // Each outcome box tints from ITS OWN bookmaker when one is set,
          // else falls back to the account's default exchange - so a leg
          // stands apart from its siblings the moment it gets its own venue.
          const plate = resolveBackPlateColors(
            leg.bookmaker,
            defaultExchange
          );
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-2.5 dark:bg-[var(--panel-dark)]",
                PANEL_TINT_TRANSITION
              )}
              style={
                panelTintVars(
                  tintReady ? plate.light : null,
                  tintReady ? plate.dark : null
                ) as React.CSSProperties
              }
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-1.5 top-1.5 text-black/45 hover:bg-black/10 hover:text-black/75 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                disabled={legs.length <= minLegs}
                onClick={() => {
                  setLegs((prev) => prev.filter((_, j) => j !== i));
                  setOverrides((prev) => prev.filter((_, j) => j !== i));
                }}
                aria-label={`Remove outcome ${i + 1}`}
              >
                <X />
              </Button>
              <div className="flex items-end gap-2 pr-6">
                <div className="min-w-0 flex-1">
                  <PanelTextInput
                    label="Outcome"
                    value={leg.label}
                    onChange={(v) => updateLeg(i, { label: v })}
                    placeholder={`Outcome ${i + 1}`}
                    inputClassName="h-10 text-sm"
                  />
                </div>
                {/* Ghost chip - background matches the leg card, same idiom
                    as the Back Bet panel's "Bookie" header chip. */}
                <VenueSelect
                  compact
                  value={leg.bookmaker ?? ""}
                  onChange={(v) => updateLeg(i, { bookmaker: v })}
                  className="shrink-0 [--pi:transparent] [--pi-dark:transparent]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                <PanelInput
                  label="Odds"
                  value={leg.odds}
                  onChange={(v) => updateLeg(i, { odds: v })}
                  min={1.01}
                  exchangeOddsStepping
                  inputClassName="h-10 text-sm"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-black/60 dark:text-white/70">
                    Stake
                  </span>
                  {isFreeLeg ? (
                    <div className="flex h-10 items-center gap-1 rounded-md bg-[var(--pi)] px-2.5 dark:bg-[var(--pi-dark)]">
                      <Gift className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                      <span className="truncate text-sm font-bold tabular-nums text-black/85 dark:text-white/95">
                        <MoneyFlow value={legResult?.stake ?? 0} />
                      </span>
                    </div>
                  ) : (
                    <DutchStakeField
                      value={legResult?.stake ?? 0}
                      custom={!isScaleLeg && isCustomStake(i)}
                      increment={roundTo}
                      onCommit={(stake) => {
                        if (isScaleLeg) setFixedLegStakeInput(stake);
                        else setLegOverride(i, stake);
                      }}
                      onReset={() => {
                        if (isScaleLeg) return;
                        setLegOverride(i, null);
                      }}
                    />
                  )}
                </div>
              </div>
              {legResult ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs text-black/55 dark:text-white/60">
                    If this wins{" "}
                    <MoneyFlow
                      value={legResult.profitIfWins}
                      signColor
                      signDisplay
                      className="font-semibold"
                    />
                  </p>
                  {!isFreeLeg && !isScaleLeg && isCustomStake(i) ? (
                    <span className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs">
                      <span className="font-semibold text-muted-foreground">Custom</span>
                      <button
                        type="button"
                        className="font-medium text-primary-text underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={() => setLegOverride(i, null)}
                      >
                        Reset
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-black/15 bg-black/5 text-black/80 hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white/90 dark:hover:bg-white/15"
          disabled={legs.length >= maxLegs}
          onClick={() => {
            setLegs((prev) => [...prev, { label: `Outcome ${prev.length + 1}`, odds: 3 }]);
            setOverrides((prev) => [...prev, null]);
          }}
        >
          <Plus className="size-4" /> Add outcome
        </Button>
      </div>

      {legsValid && lastIndex >= 1 ? (
        <DutchWeightSlider
          firstLabel={legs[0]?.label || "First"}
          lastLabel={legs[lastIndex]?.label || "Last"}
          value={shownBias}
          onInput={onBiasInput}
          onRelease={endBiasDrag}
          onReset={() => applyEndBias(DUTCH_END_BIAS_CENTER, true)}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {result && result.equalised === false ? "Worst profit" : "Equal profit"}
          </div>
          <div className="text-lg font-bold">
            <MoneyFlow value={result?.profit ?? 0} signColor signDisplay />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            {freeLegActive ? "Cash outlay" : "Total stake"}
          </div>
          <div className="text-lg font-bold tabular-nums">
            <MoneyFlow
              value={freeLegActive ? (result?.totalStake ?? 0) - fixedLegStakeInput : (result?.totalStake ?? 0)}
            />
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Overround
          </div>
          <div className="text-lg font-bold">
            <PercentFlow value={result?.overroundPct ?? 0} digits={2} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/** First-vs-last weighting. Centre is the equal-profit split, not a 50/50 cash split. */
function DutchWeightSlider({
  firstLabel,
  lastLabel,
  value,
  onInput,
  onRelease,
  onReset,
}: {
  firstLabel: string;
  lastLabel: string;
  value: number;
  onInput: (bias: number) => void;
  onRelease: () => void;
  onReset: () => void;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-6" onDoubleClick={onReset}>
        <div
          className="absolute left-1/2 top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 bg-black/35 dark:bg-white/35"
          aria-hidden
        />
        <ChevronDown
          className="pointer-events-none absolute top-0 z-10 size-3.5 -translate-x-1/2 text-primary-text"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(value.toFixed(2))}
          aria-label={`Favour ${firstLabel} or ${lastLabel}`}
          onChange={(e) => onInput(parseFloat(e.target.value))}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          onBlur={onRelease}
          className="absolute inset-x-0 top-1/2 h-1.5 w-full -translate-y-1/2 cursor-pointer appearance-none rounded-full bg-black/20 dark:bg-white/20 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent"
        />
      </div>
      <div className="flex justify-between gap-3 text-xs font-semibold text-muted-foreground">
        <span className="min-w-0 truncate">{firstLabel}</span>
        <span className="min-w-0 truncate text-right">{lastLabel}</span>
      </div>
    </div>
  );
}

/** Draft-on-focus so clearing the field does not snap back to the suggestion mid-type. */
function DutchStakeField({
  value,
  custom,
  increment,
  onCommit,
  onReset,
}: {
  value: number;
  custom: boolean;
  increment: number;
  onCommit: (stake: number) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? formatMoneyAmount(value) : "");

  function currentStake(): number {
    if (draft != null && draft.trim() !== "") {
      const parsed = parseFloat(draft);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function step(direction: 1 | -1) {
    const next = stepByIncrement(currentStake(), increment, direction);
    setDraft(formatMoneyAmount(next));
    onCommit(next);
  }

  const wheelRef = useNonPassiveWheel<HTMLInputElement>((e) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    step(e.deltaY > 0 ? -1 : 1);
  });

  return (
    <span className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-black/45 dark:text-white/50">
        £
      </span>
      <input
        ref={wheelRef}
        type="number"
        inputMode="decimal"
        step={increment}
        min={0}
        aria-label={custom ? "Stake, custom" : "Stake, suggested"}
        value={shown}
        onFocus={() => setDraft(Number.isFinite(value) ? formatMoneyAmount(value) : "")}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = parseFloat(next);
          if (Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        onBlur={() => {
          const parsed = draft == null ? Number.NaN : parseFloat(draft);
          if (draft == null || draft.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
            onReset();
          } else {
            onCommit(parsed);
          }
          setDraft(null);
        }}
        className={cn(
          "h-10 w-full rounded-md border-0 bg-[var(--pi)] pl-8 pr-9 text-sm font-bold tabular-nums text-black/85 outline-none ring-primary/40 [appearance:textfield] placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          fieldControlShadow,
          PANEL_TINT_TRANSITION
        )}
      />
      <NumberStepperButtons onStepUp={() => step(1)} onStepDown={() => step(-1)} />
    </span>
  );
}
