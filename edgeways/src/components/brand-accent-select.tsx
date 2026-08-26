"use client";

/**
 * Brand accent picker — named presets + Custom colour.
 * Shows a loader on the chosen swatch until settle; selected style stays on
 * the previous colour and moves to the new one only when apply is ready.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Pipette, SwatchBook } from "lucide-react";
import { useBrandAccent } from "@/components/brand-accent-provider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  BRAND_ACCENT_PRESETS,
  normalizeHex,
  type BrandAccentPresetId,
} from "@/lib/brand-accent";
import { cn } from "@/lib/utils";

export function BrandAccentSelect({
  className,
  compact = false,
  onPersist,
}: {
  className?: string;
  /** Compact swatch row for side nav (presets only). */
  compact?: boolean;
  /** Optional save to AppSettings (Settings page) — after theme is ready. */
  onPersist?: (presetId: BrandAccentPresetId, hex: string) => void;
}) {
  const { presetId, hex, pending, setPreset, setCustomHex } = useBrandAccent();
  const [hexDraft, setHexDraft] = useState(hex);
  const [prevHex, setPrevHex] = useState(hex);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersist = useRef<{
    id: BrandAccentPresetId;
    hex: string;
  } | null>(null);

  // presetId/hex only advance after settle — safe to mirror into the draft.
  if (prevHex !== hex) {
    setPrevHex(hex);
    setHexDraft(hex);
  }

  function flushPersist() {
    const pending = pendingPersist.current;
    pendingPersist.current = null;
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (pending && onPersist) onPersist(pending.id, pending.hex);
  }

  function schedulePersist(
    id: BrandAccentPresetId,
    nextHex: string,
    immediate = false
  ) {
    if (!onPersist) return;
    pendingPersist.current = { id, hex: nextHex };
    if (persistTimer.current) clearTimeout(persistTimer.current);
    if (immediate) {
      persistTimer.current = null;
      pendingPersist.current = null;
      onPersist(id, nextHex);
      return;
    }
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      flushPersist();
    }, 300);
  }

  useEffect(() => {
    return () => {
      flushPersist();
    };
    // Flush the last typed custom hex if Settings unmounts mid-debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickPreset(id: Exclude<BrandAccentPresetId, "custom">) {
    const resolved = await setPreset(id);
    schedulePersist(resolved.presetId, resolved.hex, true);
  }

  async function pickCustom(nextHex: string) {
    const normalized = normalizeHex(nextHex);
    if (!normalized) return;
    const resolved = await setCustomHex(normalized);
    schedulePersist(resolved.presetId, resolved.hex);
  }

  function isPendingFor(id: BrandAccentPresetId, swatchHex?: string) {
    if (!pending) return false;
    if (pending.presetId !== id) return false;
    if (id === "custom" && swatchHex) return pending.hex === normalizeHex(swatchHex);
    return true;
  }

  /** Committed selection only — `presetId` updates after apply settles. */
  function isSelectedFor(id: BrandAccentPresetId) {
    return presetId === id;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact ? (
        <>
          <div className="flex items-center gap-2">
            <SwatchBook className="size-4 text-muted-foreground" aria-hidden />
            <Label className="text-sm font-semibold">Brand colour</Label>
          </div>
          <p className="text-xs text-muted-foreground">App accent.</p>
        </>
      ) : null}

      <div
        role="listbox"
        aria-label="Brand colour presets"
        aria-busy={pending !== null}
        className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}
      >
        {BRAND_ACCENT_PRESETS.map((preset) => {
          const selected = isSelectedFor(preset.id);
          const loading = isPendingFor(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-busy={loading}
              aria-label={preset.label}
              title={preset.label}
              disabled={loading}
              onClick={() => void pickPreset(preset.id)}
              className={cn(
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                compact
                  ? cn(
                      "relative flex size-7 items-center justify-center rounded-full",
                      selected &&
                        !loading &&
                        "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    )
                  : cn(
                      "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-foreground/25 bg-muted text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )
              )}
            >
              <span
                className={cn(
                  "relative flex shrink-0 items-center justify-center rounded-full ring-1 ring-border/80",
                  compact ? "size-5" : "size-4"
                )}
                style={{ backgroundColor: preset.hex }}
                aria-hidden
              >
                {loading ? (
                  <Loader2
                    className={cn(
                      "animate-spin text-[oklch(0.178_0_0)] mix-blend-difference",
                      "size-3"
                    )}
                  />
                ) : null}
              </span>
              {compact ? null : <span>{preset.label}</span>}
            </button>
          );
        })}

        <button
          type="button"
          role="option"
          aria-selected={isSelectedFor("custom")}
          aria-busy={isPendingFor("custom")}
          aria-label="Custom brand colour"
          title="Custom"
          disabled={isPendingFor("custom")}
          onClick={() => {
            void (async () => {
              const resolved = await setPreset("custom");
              schedulePersist(resolved.presetId, resolved.hex, true);
            })();
          }}
          className={cn(
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            compact
              ? cn(
                  "relative flex size-7 items-center justify-center rounded-full",
                  isSelectedFor("custom") &&
                    !isPendingFor("custom") &&
                    "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                )
              : cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  isSelectedFor("custom")
                    ? "border-foreground/25 bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )
          )}
        >
          <span
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-full ring-1 ring-border/80",
              compact ? "size-5" : "size-4"
            )}
            style={{ backgroundColor: pending?.presetId === "custom" ? pending.hex : hex }}
            aria-hidden
          >
            {isPendingFor("custom") ? (
              <Loader2
                className={cn(
                  "animate-spin text-[oklch(0.178_0_0)] mix-blend-difference",
                  "size-3"
                )}
              />
            ) : (
              <Pipette className="size-3 text-[oklch(0.178_0_0)] mix-blend-difference" />
            )}
          </span>
          {compact ? null : <span>Custom</span>}
        </button>
      </div>

      {!compact && (presetId === "custom" || pending?.presetId === "custom") ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-accent-color" className="text-xs text-muted-foreground">
              Colour
            </Label>
            <input
              id="brand-accent-color"
              type="color"
              value={normalizeHex(pending?.presetId === "custom" ? pending.hex : hex) ?? "#FFC71E"}
              onChange={(e) => void pickCustom(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded-md border border-transparent bg-transparent p-0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-accent-hex" className="text-xs text-muted-foreground">
              Hex
            </Label>
            <Input
              id="brand-accent-hex"
              value={hexDraft}
              onChange={(e) => {
                setHexDraft(e.target.value);
                const n = normalizeHex(e.target.value);
                if (n) void pickCustom(n);
              }}
              onBlur={() => {
                const n = normalizeHex(hexDraft);
                if (n) {
                  void pickCustom(n);
                  setHexDraft(n);
                } else {
                  setHexDraft(hex);
                }
              }}
              placeholder="#FFC71E"
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              className="w-[calc(7ch+1.25rem)] font-mono uppercase"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
