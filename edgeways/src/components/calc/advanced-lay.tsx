"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LayStakeBanner, PanelInput } from "@/components/calc/bet-panels";
import { cn } from "@/lib/utils";
import { highlightedLaySnap } from "@/lib/add-bet-lay-stake";
import { formatGbp } from "@/lib/format-money";
import { fieldControlShadow } from "@/lib/ui/surface-styles";
import type { LayBounds, PartLay } from "@/lib/calc";
import { Plus, X } from "lucide-react";

const RANGE_FIELD = cn(
  "h-7 w-20 rounded-md border-0 bg-[var(--pi)] px-2 text-xs font-semibold tabular-nums text-black/85 outline-none ring-primary/40 [appearance:textfield] focus:ring-2",
  "dark:bg-[var(--pi-dark)] dark:text-white/90",
  "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  fieldControlShadow
);

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
  lockedSnap = null,
  onLockedSnap,
}: {
  bounds: LayBounds;
  layStake: number;
  onLayStake: (v: number) => void;
  partLays: PartLay[];
  onPartLays: (v: PartLay[]) => void;
  /** Slider/button accent (exchange brand colour) */
  accent?: string;
  className?: string;
  /** Parent-owned Underlay / Standard / Overlay lock. */
  lockedSnap?: keyof LayBounds | null;
  onLockedSnap?: (snap: keyof LayBounds | null) => void;
}) {
  const [minOverride, setMinOverride] = useState<number | null>(null);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  /** Local thumb while dragging so the track stays 1:1 with the pointer. */
  const [dragStake, setDragStake] = useState<number | null>(null);
  const pendingStake = useRef<number | null>(null);
  const rafId = useRef(0);

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
  const displayStake = dragStake ?? layStake;

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  function flushLayStake() {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    if (pendingStake.current != null) {
      onLayStake(pendingStake.current);
      pendingStake.current = null;
    }
  }

  /** At most one parent update per frame while scrubbing the range. */
  function scheduleLayStake(next: number) {
    pendingStake.current = next;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      if (pendingStake.current != null) {
        onLayStake(pendingStake.current);
        pendingStake.current = null;
      }
    });
  }

  function endDrag() {
    flushLayStake();
    setDragStake(null);
  }

  const snaps: { key: keyof LayBounds; label: string; hint: string }[] = [
    { key: "underlay", label: "Underlay", hint: "£0 if bookie bet loses" },
    { key: "standard", label: "Standard", hint: "equal profit either way" },
    { key: "overlay", label: "Overlay", hint: "£0 if bookie bet wins" },
  ];

  const activeSnap = highlightedLaySnap(displayStake, bounds, lockedSnap);
  const snapSelected = (key: keyof LayBounds) => activeSnap === key;

  function clearLockedSnap() {
    if (lockedSnap != null) onLockedSnap?.(null);
  }

  return (
    <div
      className={cn(
        "[--adv-pi:color-mix(in_srgb,var(--pi)_82%,black)]",
        "[--adv-pi-dark:color-mix(in_srgb,var(--pi-dark)_72%,black)]",
        className
      )}
    >
      <div className="flex flex-col gap-3 [--pi:var(--adv-pi)] [--pi-dark:var(--adv-pi-dark)]">
      {/* Part lays already placed */}
      {partLays.map((part, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 max-sm:grid-cols-1"
        >
          <PanelInput
            label={`Part lay ${i + 1} odds`}
            value={part.odds}
            min={1.01}
            density="compact"
            exchangeOddsStepping
            onChange={(odds) =>
              onPartLays(partLays.map((p, j) => (j === i ? { ...p, odds } : p)))
            }
          />
          <LayStakeBanner
            label="Stake"
            value={part.stake}
            density="compact"
            trailing="steppers"
            onChange={(stake) =>
              onPartLays(partLays.map((p, j) => (j === i ? { ...p, stake } : p)))
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove part lay ${i + 1}`}
            onClick={() => onPartLays(partLays.filter((_, j) => j !== i))}
            className="mb-1.5 text-black/50 hover:bg-black/10 hover:text-black/80 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white/80 max-sm:mb-0 max-sm:justify-self-end"
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5"
        onClick={() => onPartLays([...partLays, { odds: NaN, stake: NaN }])}
      >
        <Plus className="size-3.5" /> Add part lay
      </Button>

      {/* Underlay / Standard / Overlay snaps */}
      <div className="flex items-center justify-between">
        {snaps.map((snap) => (
          <button
            key={snap.key}
            type="button"
            title={snap.hint}
            aria-pressed={snapSelected(snap.key)}
            onClick={() => {
              setDragStake(null);
              flushLayStake();
              onLockedSnap?.(snap.key);
              onLayStake(Math.round(bounds[snap.key] * 100) / 100);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              snapSelected(snap.key)
                ? "text-white"
                : "bg-black/15 text-black/70 hover:bg-black/25 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/25"
            )}
            style={snapSelected(snap.key) ? { backgroundColor: accent } : undefined}
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
        value={Math.min(Math.max(displayStake, min), max)}
        onChange={(e) => {
          const next = parseFloat(e.target.value);
          clearLockedSnap();
          setDragStake(next);
          scheduleLayStake(next);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onBlur={endDrag}
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
            className={RANGE_FIELD}
          />
        </label>
        <span className="font-semibold tabular-nums text-black/70 dark:text-white/80">
          {formatGbp(displayStake)}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="font-medium text-black/60 dark:text-white/60">Max £</span>
          <input
            type="number"
            inputMode="decimal"
            step={0.01}
            value={Number(max.toFixed(2))}
            onChange={(e) => setMaxOverride(parseFloat(e.target.value))}
            className={RANGE_FIELD}
          />
        </label>
      </div>
      </div>
    </div>
  );
}
