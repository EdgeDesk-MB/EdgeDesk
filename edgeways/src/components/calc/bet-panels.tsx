"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoneyFlow } from "@/components/money-flow";
import { SportIcon } from "@/components/sport-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookiePanelTint } from "@/lib/brands/bookies";
import { contrastText, darken, lighten } from "@/lib/brands/exchanges";
import type { ExchangeRow } from "@/lib/db/schema";
import { exchangeOddsStepHandlers } from "@/lib/calc/exchange-odds-step";
import { cn } from "@/lib/utils";
import { Copy, ChevronDown } from "lucide-react";

/**
 * Neutral panel until a bookie (back) or exchange (lay) brand is known.
 * Brand colours fade in via `@property` + `.bet-panel-tint` transitions.
 * Legacy MBB greens/blues are no longer used as load defaults.
 */
export const PANEL_NEUTRAL = "#d4d4d8";
/** @deprecated Prefer PANEL_NEUTRAL; kept for any intentional green accent. */
export const BACK_LIGHT = "#5fc478";

/** Shared transition for panel / input / chevron brand tints. */
const PANEL_TINT_TRANSITION =
  "bet-panel-tint transition-[background-color] duration-300 ease-out";

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Base colour; defaults to neutral grey until a brand tint is supplied */
  color?: string;
  chip?: React.ReactNode;
}

/**
 * Coloured bet panel. Starts neutral, then fades to bookie / exchange brand.
 * Input tints are derived from the panel colour (lightened in light mode,
 * darkened in dark mode) so Betdaq / Betfair / bookie themes stay coherent.
 */
function Panel({ title, children, className, color, chip }: PanelProps) {
  const base = color ?? PANEL_NEUTRAL;
  return (
    <div
      className={cn("overflow-hidden rounded-xl", className)}
      style={
        {
          "--panel": base,
          "--panel-dark": darken(base, 0.72),
          "--pi": lighten(base, 0.62),
          "--pi-dark": darken(base, 0.5),
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "bg-[var(--panel)] p-4 dark:bg-[var(--panel-dark)]",
          PANEL_TINT_TRANSITION
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold tracking-tight text-black/80 dark:text-white/95">
            {title}
          </h3>
          {chip}
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

export function BackPanel({
  exchange,
  venue,
  color,
  ...props
}: Omit<PanelProps, "color"> & {
  exchange?: ExchangeRow | null;
  /** Selected bookmaker/venue - wins over exchange back colour. */
  venue?: string;
  /** Explicit tint wins over venue / exchange. */
  color?: string;
}) {
  const venueTint = venue?.trim() ? bookiePanelTint(venue) : null;
  // No bookie: use the selected exchange's back colour (Calculators, matched, etc.).
  // Still grey until an exchange is known - never the old MBB green default.
  return (
    <Panel
      {...props}
      color={color ?? venueTint ?? exchange?.backColor ?? PANEL_NEUTRAL}
    />
  );
}

export function LayPanel({
  exchange,
  color,
  ...props
}: Omit<PanelProps, "color"> & {
  exchange?: ExchangeRow | null;
  /** Explicit tint wins over exchange lay colour. */
  color?: string;
}) {
  return <Panel {...props} color={color ?? exchange?.layColor ?? PANEL_NEUTRAL} />;
}

/**
 * Input styled to sit on a coloured panel - MBB look: big, bold numbers on a
 * lighter tint of the panel colour (inherited via CSS vars from <Panel>).
 */
export function PanelInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 0.01,
  min,
  placeholder,
  inputClassName,
  exchangeOddsStepping,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  placeholder?: string;
  inputClassName?: string;
  /** Exchange lay-odds ladder for ArrowUp/ArrowDown only */
  exchangeOddsStepping?: boolean;
}) {
  const exchangeStep = exchangeOddsStepping
    ? exchangeOddsStepHandlers(value, onChange)
    : null;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">{label}</span>
      <span className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-black/45 dark:text-white/50">
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          placeholder={placeholder}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onKeyDown={exchangeStep?.onKeyDown}
          onWheel={exchangeStep?.onWheel}
          className={cn(
            "h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-lg font-bold tabular-nums text-black/85 outline-none ring-primary/40 placeholder:text-base placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40",
            PANEL_TINT_TRANSITION,
            prefix && "pl-8",
            suffix && "pr-9",
            inputClassName
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold text-black/60 dark:text-white/70">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

/** Text input on a coloured panel - same height as PanelInput. */
export function PanelTextInput({
  label,
  value,
  onChange,
  placeholder,
  inputClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-lg font-bold text-black/85 outline-none ring-primary/40 placeholder:text-base placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40",
          PANEL_TINT_TRANSITION,
          inputClassName
        )}
      />
    </label>
  );
}

/** Bookmaker name field - uses panel tint CSS vars from the parent BackPanel. */
export function PanelBookieInput({
  label = "Bookmaker (optional)",
  value,
  onChange,
  placeholder = "e.g. Bet365",
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-base font-semibold text-black/85 outline-none ring-primary/40 placeholder:text-base placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40",
          PANEL_TINT_TRANSITION
        )}
      />
    </label>
  );
}

/** Select on a coloured panel - same height as PanelInput. */
export function PanelSelect({
  label,
  value,
  onChange,
  children,
  selectClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  selectClassName?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-md border-0 bg-[var(--pi)] py-0 pl-3 pr-10 text-lg font-bold text-black/85 outline-none ring-primary/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95",
            PANEL_TINT_TRANSITION,
            selectClassName
          )}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-black/60 dark:text-white/70" />
      </span>
    </label>
  );
}

/**
 * Panel-styled selection dropdown with a sport icon on each row (and in the
 * closed trigger). Used for Add bet Selection when the market has fixed options
 * or a known racecard.
 */
export function PanelIconSelect({
  label,
  value,
  onChange,
  sport,
  placeholder,
  options,
  selectClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  sport?: string | null;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  selectClassName?: string;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">{label}</span>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            "w-full rounded-md border-0 bg-[var(--pi)] py-0 pl-3 text-lg font-bold text-black/85 shadow-none outline-none ring-primary/40 focus:ring-2 focus-visible:border-transparent focus-visible:ring-2 data-[size=default]:h-11 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:hover:bg-[var(--pi-dark)] [&_svg]:text-black/60 dark:[&_svg]:text-white/70",
            PANEL_TINT_TRANSITION,
            selectClassName
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selectedLabel ? (
              <span className="flex min-w-0 items-center gap-2">
                <SportIcon
                  sport={sport}
                  size={16}
                  className="shrink-0 text-black/50 dark:text-white/60"
                />
                <span className="truncate">{selectedLabel}</span>
              </span>
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <SportIcon sport={sport} size={14} className="text-muted-foreground" />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Editable lay stake - always shows 2 dp when not being typed in. */
function LayStakeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  // While unfocused the display derives straight from `value`, and onFocus
  // seeds `text` fresh - no sync effect needed.
  const display = focused ? text : Number.isFinite(value) ? value.toFixed(2) : "";

  function stepStake(delta: number) {
    const base = focused
      ? parseFloat(text.replace(/,/g, ""))
      : value;
    const current = Number.isFinite(base) && base >= 0 ? base : 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    setText(next.toFixed(2));
    onChange(next);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={display}
      onFocus={() => {
        setFocused(true);
        setText(Number.isFinite(value) ? value.toFixed(2) : "");
      }}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(text.replace(/,/g, ""));
        if (Number.isFinite(n) && n >= 0) {
          onChange(Math.round(n * 100) / 100);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          stepStake(0.01);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          stepStake(-0.01);
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const n = parseFloat(next.replace(/,/g, ""));
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      className="h-10 w-full rounded-md border border-white/20 bg-white/10 pr-3 pl-8 text-lg font-extrabold tabular-nums text-white outline-none ring-primary/40 placeholder:text-white/30 focus:ring-2"
    />
  );
}

/** Dark lay-stake strip - read-only with optional liability, or editable with copy. */
export function LayStakeBanner({
  label = "Lay stake",
  value,
  liability,
  onChange,
  fillSelection,
}: {
  label?: string;
  value: number;
  /** Exchange liability - read-only banner only (omitted in Add bet) */
  liability?: number;
  /** When set, renders an editable input; typing updates the slider above */
  onChange?: (v: number) => void;
  /** J9: when set, a Fill slip action emits the extension intent */
  fillSelection?: string;
}) {
  const fillSlip = fillSelection?.trim()
    ? () =>
        void import("@/lib/betslip-intent").then(({ emitFillSlip }) =>
          emitFillSlip({ side: "lay", selection: fillSelection, stake: value }).then((ok) => {
            if (ok)
              toast.success(`Stake £${value.toFixed(2)} copied`, {
                description: "The extension fills the exchange slip if installed.",
              });
          })
        )
    : null;
  if (onChange) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-white dark:bg-slate-700">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-sm text-white/75">{label}</span>
          <span className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base font-semibold text-white/45">
              £
            </span>
            <LayStakeInput label={label} value={value} onChange={onChange} />
          </span>
        </label>
        {fillSlip ? (
          <button
            type="button"
            aria-label="Fill exchange slip"
            className="shrink-0 rounded bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:text-white"
            onClick={fillSlip}
          >
            Fill slip
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Copy lay stake"
          className="shrink-0 text-white/60 transition-colors hover:text-white"
          onClick={() => {
            navigator.clipboard.writeText(value.toFixed(2));
            toast.success("Lay stake copied", { description: `£${value.toFixed(2)}` });
          }}
        >
          <Copy className="size-[17.5px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-slate-800 px-4 py-3 text-sm text-white dark:bg-slate-700">
      <span className="flex items-center gap-2">
        <span>
          {label}: <MoneyFlow value={value} className="text-lg font-extrabold" />
        </span>
        <button
          type="button"
          aria-label="Copy lay stake"
          className="text-white/60 transition-colors hover:text-white"
          onClick={() => {
            navigator.clipboard.writeText(value.toFixed(2));
            toast.success("Lay stake copied", { description: `£${value.toFixed(2)}` });
          }}
        >
          <Copy className="size-3.5" />
        </button>
        {fillSlip ? (
          <button
            type="button"
            aria-label="Fill exchange slip"
            className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80 transition-colors hover:text-white"
            onClick={fillSlip}
          >
            Fill slip
          </button>
        ) : null}
      </span>
      {liability != null && (
        <span className="shrink-0 text-xs text-white/65">
          Liability:{" "}
          <span className="font-semibold tabular-nums text-white">£{liability.toFixed(2)}</span>
        </span>
      )}
    </div>
  );
}

export interface OutcomeRow {
  label: string;
  bookie: number;
  exchange: number;
  accent?: "back" | "lay";
}

/**
 * MBB-style settlement table: coloured chevron row labels (green back / blue
 * lay, or the selected exchange's colours), Bookie | Exchange | = Total.
 */
export function ProfitTable({
  rows,
  totalLabel = "Total profit",
  guaranteed,
  exchange,
  venue,
}: {
  rows: OutcomeRow[];
  totalLabel?: string;
  guaranteed: number;
  exchange?: ExchangeRow | null;
  /** Selected bookmaker/venue name for the back leg - see `BackPanel`. */
  venue?: string;
}) {
  const hasVenueTint = !!venue?.trim();
  const backBase = hasVenueTint
    ? bookiePanelTint(venue!)
    : (exchange?.backColor ?? PANEL_NEUTRAL);
  const layBase = exchange?.layColor ?? PANEL_NEUTRAL;
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium" />
              <th className="px-3 py-2 text-right font-medium">Bookie</th>
              <th className="px-3 py-2 text-right font-medium">Exchange</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isBack = row.accent !== "lay";
              const accent = isBack ? backBase : layBase;
              // Bookie tints are always a pastel (lightened toward white), same
              // assumption the rest of the panel family makes - contrastText
              // can't parse that `color-mix(...)` string, so skip it here.
              const chevText = isBack && hasVenueTint ? "#1a1a1a" : contrastText(accent);
              return (
                <tr key={row.label} className="border-t">
                  <td className="py-2 pr-3">
                    <span
                      className={cn(
                        "flex min-h-9 items-center bg-[var(--chev)] py-1 pl-3 pr-6 text-[13px] font-bold leading-tight text-[var(--chev-text)] dark:bg-[var(--chev-dark)] dark:text-white/95",
                        PANEL_TINT_TRANSITION
                      )}
                      style={
                        {
                          "--chev": accent,
                          "--chev-dark": darken(accent, 0.45),
                          "--chev-text": chevText,
                          clipPath:
                            "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                        } as React.CSSProperties
                      }
                    >
                      {row.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[15px] font-semibold tabular-nums">
                    <MoneyFlow value={row.bookie} signColor signDisplay />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[15px] font-semibold tabular-nums">
                    <MoneyFlow value={row.exchange} signColor signDisplay />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[15px] font-extrabold tabular-nums">
                    <span className="mr-0.5 text-muted-foreground">=</span>
                    <MoneyFlow value={row.bookie + row.exchange} signColor signDisplay />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
        <span className="text-sm font-bold">{totalLabel}</span>
        <MoneyFlow value={guaranteed} signColor signDisplay className="text-2xl font-extrabold" />
      </div>
    </div>
  );
}
