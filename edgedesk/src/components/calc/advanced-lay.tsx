"use client";

import { useMemo, useState } from "react";
import { exchangeOddsStepHandlers } from "@/lib/calc/exchange-odds-step";
import { cn } from "@/lib/utils";
import type { LayBounds, PartLay } from "@/lib/calc";
import { Plus, X } from "lucide-react";

/**
 * MBB-style advanced lay controls: part lays + an underlay/standard/overlay
 * slider with editable range bounds. The parent owns the lay stake and part
 * lays; this component just steers them.
 *
 * - Underlay snap → £0 net if the bookie bet LOSES
 * - Standard snap → equal profit either way
 * - Overlay snap  → £0 net if the bookie bet WINS
 */
export function AdvancedLaySection({
  bounds,
  layStake,
  onLayStake,
  partLays,
  onPartLays,
  accent = "#1e293b",
  className,
}: {
  bounds: LayBounds;
  layStake: number;
  onLayStake: (v: number) => void;
  partLays: PartLay[];
  onPartLays: (v: PartLay[]) => void;
  /** Slider/button accent (exchange brand colour) */
  accent?: string;
  className?: string;
}) {
  const [minOverride, setMinOverride] = useState<number | null>(null);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);

  const { lo, hi } = useMemo(() => {
    const values = [bounds.underlay, bounds.overlay, bounds.standard].filter(
      (v) => Number.isFinite(v) && v >= 0
    );
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    // A little breathing room so the zero-loss points aren't pinned to the ends
    return { lo: Math.max(0, Math.floor(lo * 100 - 2) / 100), hi: Math.ceil(hi * 100 + 2) / 100 };
  }, [bounds]);

  const min = minOverride ?? lo;
  const max = Math.max(maxOverride ?? hi, min + 0.01);

  const snaps: { key: keyof LayBounds; label: string; hint: string }[] = [
    { key: "underlay", label: "Underlay", hint: "£0 if bookie bet loses" },
    { key: "standard", label: "Standard", hint: "equal profit either way" },
    { key: "overlay", label: "Overlay", hint: "£0 if bookie bet wins" },
  ];

  const active = (v: number) => Math.abs(layStake - v) < 0.005;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Part lays already placed */}
      {partLays.map((part, i) => {
        const oddsStep = exchangeOddsStepHandlers(part.odds, (odds) =>
          onPartLays(partLays.map((p, j) => (j === i ? { ...p, odds } : p)))
        );
        return (
        <div key={i} className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-black/60 dark:text-white/60">
              Part lay {i + 1} odds
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1.01}
              step={0.01}
              value={Number.isFinite(part.odds) ? part.odds : ""}
              onChange={(e) =>
                onPartLays(
                  partLays.map((p, j) => (j === i ? { ...p, odds: parseFloat(e.target.value) } : p))
                )
              }
              onKeyDown={oddsStep.onKeyDown}
              onWheel={oddsStep.onWheel}
              className="h-9 w-full rounded-md border-0 bg-black/10 px-3 text-sm font-semibold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/90"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-black/60 dark:text-white/60">Stake</span>
            <span className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/50 dark:text-white/50">
                £
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={Number.isFinite(part.stake) ? part.stake : ""}
                onChange={(e) =>
                  onPartLays(
                    partLays.map((p, j) =>
                      j === i ? { ...p, stake: parseFloat(e.target.value) } : p
                    )
                  )
                }
                className="h-9 w-full rounded-md border-0 bg-black/10 pl-7 pr-3 text-sm font-semibold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/90"
              />
            </span>
          </label>
          <button
            type="button"
            aria-label={`Remove part lay ${i + 1}`}
            onClick={() => onPartLays(partLays.filter((_, j) => j !== i))}
            className="mb-1.5 rounded-md p-1.5 text-black/50 transition-colors hover:bg-black/10 hover:text-black/80 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white/80"
          >
            <X className="size-4" />
          </button>
        </div>
        );
      })}
      <button
        type="button"
        onClick={() => onPartLays([...partLays, { odds: NaN, stake: NaN }])}
        className="flex h-8 w-full items-center justify-center gap-1 rounded-full bg-black/15 text-xs font-semibold text-black/70 transition-colors hover:bg-black/25 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/25"
      >
        <Plus className="size-3.5" /> Add part lay
      </button>

      {/* Underlay / Standard / Overlay snaps */}
      <div className="flex items-center justify-between">
        {snaps.map((snap) => (
          <button
            key={snap.key}
            type="button"
            title={snap.hint}
            onClick={() => onLayStake(Math.round(bounds[snap.key] * 100) / 100)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active(bounds[snap.key])
                ? "text-white"
                : "bg-black/15 text-black/70 hover:bg-black/25 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/25"
            )}
            style={active(bounds[snap.key]) ? { backgroundColor: accent } : undefined}
          >
            {snap.label}
          </button>
        ))}
      </div>

      <input
        type="range"
        aria-label="Lay stake"
        min={min}
        max={max}
        step={0.01}
        value={Math.min(Math.max(layStake, min), max)}
        onChange={(e) => onLayStake(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/20 dark:bg-white/20"
        style={{ accentColor: accent }}
      />

      <div className="flex items-center justify-between gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="font-medium text-black/60 dark:text-white/60">Min £</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.01}
            value={Number(min.toFixed(2))}
            onChange={(e) => setMinOverride(parseFloat(e.target.value))}
            className="h-7 w-20 rounded-md border-0 bg-black/10 px-2 text-xs font-semibold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/90"
          />
        </label>
        <span className="font-semibold tabular-nums text-black/70 dark:text-white/80">
          £ {Number.isFinite(layStake) ? layStake.toFixed(2) : "-"}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="font-medium text-black/60 dark:text-white/60">Max £</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.01}
            value={Number(max.toFixed(2))}
            onChange={(e) => setMaxOverride(parseFloat(e.target.value))}
            className="h-7 w-20 rounded-md border-0 bg-black/10 px-2 text-xs font-semibold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/90"
          />
        </label>
      </div>
    </div>
  );
}
