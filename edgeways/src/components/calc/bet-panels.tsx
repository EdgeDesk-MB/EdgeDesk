"use client";

import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { NumberFlowGroup } from "@number-flow/react";
import { MoneyFlow } from "@/components/money-flow";
import { SportIcon } from "@/components/sport-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppState } from "@/hooks/use-app-state";
import { useNonPassiveWheel } from "@/hooks/use-non-passive-wheel";
import {
  contrastText,
  muteForDark,
  panelTintVars,
} from "@/lib/brands/exchanges";
import {
  resolveBackPlateColors,
  resolveLayPlateColors,
} from "@/lib/brands/panel-tints";
import type { ExchangeRow } from "@/lib/db/schema";
import {
  exchangeOddsStepHandlers,
  handleExchangeOddsInputEvent,
  stepExchangeOdds,
} from "@/lib/calc/exchange-odds-step";
import { roundPence, stepByIncrement } from "@/lib/calc/money";
import { NumberStepperButtons } from "@/components/ui/number-stepper-buttons";
import { fieldControlShadow } from "@/lib/ui/surface-styles";
import {
  commitLayStake,
  formatLayStake,
  layStakeStepHandlers,
  stepLayStake,
} from "@/lib/calc/exchange-stake-step";
import type { BookieBreakdownLine } from "@/lib/calc/matched";
import { formatGbp } from "@/lib/format-money";
import {
  layFirstTintDelayMs,
  noteBackFirstTint,
  prefersReducedPanelMotion,
} from "@/lib/ui/bet-panel-reveal";
import { cn } from "@/lib/utils";
import { Copy, ChevronDown } from "lucide-react";

/** Settings `brandColor` for a venue name, matching VenueBadge / VenueSelect. */
function useVenueBrandOverride(venue?: string): string | null {
  const { state } = useAppState(0);
  return useMemo(() => {
    const trimmed = venue?.trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    return (
      state?.balances?.accounts?.find(
        (a) => a.name.toLowerCase() === key && a.brandColor?.trim()
      )?.brandColor?.trim() ?? null
    );
  }, [venue, state?.balances?.accounts]);
}

/**
 * First paint is the empty page-mix plate. After two frames the brand
 * tint can settle (shine wipe), never a stale grey or the previous bookie.
 */
export function useSettledPanelTint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return ready;
}

type PanelTintRole = "back" | "lay";

type AppliedTint = { light: string | null; dark: string | null };

function tintKey(tint: AppliedTint | null): string {
  if (!tint) return "";
  return `${tint.light ?? ""}|${tint.dark ?? ""}`;
}

function usePanelShineTint(
  role: PanelTintRole,
  color?: string | null,
  colorDark?: string | null
): {
  contentVars: React.CSSProperties;
  baseVars: React.CSSProperties;
  fillVars: React.CSSProperties;
  wipeId: number;
  finishWipe: () => void;
} {
  const ready = useSettledPanelTint();
  const [applied, setApplied] = useState<AppliedTint | null>(null);
  const [prev, setPrev] = useState<AppliedTint | null>(null);
  const [wipeId, setWipeId] = useState(0);
  const appliedRef = useRef<AppliedTint | null>(null);
  const hadTint = useRef(false);
  appliedRef.current = applied;

  const target: AppliedTint = {
    light: ready ? (color ?? null) : null,
    dark: ready ? (colorDark ?? null) : null,
  };
  const targetId = tintKey(target);
  const appliedId = tintKey(applied);
  const isFirstTint = !hadTint.current && target.light != null;

  useLayoutEffect(() => {
    if (!ready || targetId === appliedId) return;
    if (role === "back" && isFirstTint) noteBackFirstTint();
  }, [ready, targetId, appliedId, role, isFirstTint]);

  useEffect(() => {
    if (!ready) return;
    if (targetId === appliedId) return;

    const reduced = prefersReducedPanelMotion();
    let timer = 0;
    let frame = 0;
    let cancelled = false;

    const apply = (delay: number) => {
      timer = window.setTimeout(() => {
        setPrev(appliedRef.current);
        setApplied(target);
        if (target.light != null) hadTint.current = true;
        if (!reduced && (target.light != null || appliedRef.current?.light != null)) {
          setWipeId((n) => n + 1);
        }
      }, delay);
    };

    if (!reduced && role === "lay" && isFirstTint) {
      // Wait a frame so a sibling Back can note this load pair first.
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        apply(layFirstTintDelayMs());
      });
    } else {
      apply(0);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // appliedId is read only to skip no-ops; applied is via ref inside the timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, targetId, role, target.light, target.dark, isFirstTint]);

  const emptyVars = panelTintVars(null);
  const prevVars = panelTintVars(prev?.light ?? null, prev?.dark ?? null);
  const fillVars = panelTintVars(applied?.light ?? null, applied?.dark ?? null);
  const shine = wipeId > 0;
  const undercoat = shine
    ? prev
      ? prevVars
      : emptyVars
    : applied
      ? fillVars
      : emptyVars;
  return {
    contentVars: (applied ? fillVars : emptyVars) as React.CSSProperties,
    baseVars: undercoat as React.CSSProperties,
    fillVars: fillVars as React.CSSProperties,
    wipeId,
    finishWipe: () => {
      setPrev(applied);
      setWipeId(0);
    },
  };
}

/** Shared transition for panel / input / chevron brand tints. */
export const PANEL_TINT_TRANSITION =
  "bet-panel-tint transition-[background-color] duration-500 ease-out";

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Light-mode plate. Null / omitted = empty page-mix until a brand settles. */
  color?: string | null;
  /** Dark-mode plate. Derived via muteForDark when omitted. */
  colorDark?: string | null;
  chip?: React.ReactNode;
  /** Strip flush under the plate (Add bet Early payout / Advanced lay). */
  footer?: React.ReactNode;
  /** Back paints first on load; Lay waits 25ms only on that first pair. */
  tintRole: PanelTintRole;
}

/**
 * Coloured bet panel. First paint is the empty page-mix plate. Brand colour
 * then shines in top-to-bottom (50ms). Inputs inherit `--pi` / `--pi-dark`.
 */
function Panel({
  title,
  children,
  className,
  color,
  colorDark,
  chip,
  footer,
  tintRole,
}: PanelProps) {
  const { contentVars, baseVars, fillVars, wipeId, finishWipe } = usePanelShineTint(
    tintRole,
    color,
    colorDark
  );
  const hasFooter = footer != null;
  const shine = wipeId > 0;

  return (
    <div
      className={cn(
        "relative rounded-xl",
        hasFooter
          ? "overflow-hidden bg-[color-mix(in_srgb,var(--panel)_68%,white)] dark:bg-[color-mix(in_srgb,var(--panel-dark)_72%,black)]"
          : "overflow-visible",
        className
      )}
      data-bet-panel={tintRole}
      style={contentVars}
    >
      <div className="surface-glass relative z-10 overflow-hidden rounded-xl bg-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl bg-[var(--panel)] dark:bg-[var(--panel-dark)]"
          style={baseVars}
        />
        {shine ? (
          <div
            key={wipeId}
            aria-hidden
            className="bet-panel-shine-fill pointer-events-none absolute inset-0 rounded-xl bg-[var(--panel)] dark:bg-[var(--panel-dark)]"
            style={fillVars}
            onAnimationEnd={finishWipe}
          />
        ) : null}
        <div
          className={cn(
            "relative px-4 pt-4",
            hasFooter
              ? "rounded-b-xl pb-[calc(1rem+var(--radius-xl))]"
              : "pb-4"
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="shrink-0 text-base font-extrabold tracking-tight text-black/80 dark:text-white/95">
              {title}
            </h3>
            {chip ? <div className="min-w-0">{chip}</div> : null}
          </div>
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>
      {hasFooter ? (
        <div className="bet-panel-ep-edge relative z-0 rounded-b-xl px-4 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function BackPanel({
  exchange,
  venue,
  color,
  colorDark,
  ...props
}: Omit<PanelProps, "color" | "colorDark" | "tintRole"> & {
  exchange?: ExchangeRow | null;
  /** Selected bookmaker/venue - exchange names use back-cell colour, not the mark. */
  venue?: string;
  /** Explicit tint wins over venue / exchange. */
  color?: string | null;
  colorDark?: string | null;
}) {
  const brandOverride = useVenueBrandOverride(venue);
  const plate = color
    ? { light: color, dark: colorDark ?? muteForDark(color) }
    : resolveBackPlateColors(venue, exchange, brandOverride);
  return <Panel {...props} tintRole="back" color={plate.light} colorDark={plate.dark} />;
}

export function LayPanel({
  exchange,
  color,
  colorDark,
  ...props
}: Omit<PanelProps, "color" | "colorDark" | "tintRole"> & {
  exchange?: ExchangeRow | null;
  /** Explicit tint wins over exchange lay colour. */
  color?: string | null;
  colorDark?: string | null;
}) {
  const plate = color
    ? { light: color, dark: colorDark ?? muteForDark(color) }
    : resolveLayPlateColors(exchange);
  return <Panel {...props} tintRole="lay" color={plate.light} colorDark={plate.dark} />;
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
  density = "default",
  exchangeOddsStepping,
  incrementStepping,
  disabled,
  invalid,
  describedBy,
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
  /** `compact` is h-9 + compact steppers (Advanced / strip fields). */
  density?: "default" | "compact";
  /** Exchange lay-odds ladder for arrows / spinner. Typed prices stay. */
  exchangeOddsStepping?: boolean;
  /** Arrow / wheel steps on this increment grid (from zero). Never below £0. */
  incrementStepping?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const exchangeStep =
    !disabled && exchangeOddsStepping
      ? exchangeOddsStepHandlers(value, onChange)
      : null;
  const increment =
    !disabled && incrementStepping != null && incrementStepping > 0
      ? incrementStepping
      : null;
  function stepIncrement(direction: 1 | -1) {
    if (increment == null) return;
    const current = Number.isFinite(value) && value >= 0 ? value : 0;
    onChange(stepByIncrement(current, increment, direction));
  }
  const incrementWheel =
    increment != null
      ? (e: { deltaY: number; preventDefault: () => void }) => {
          if (e.deltaY === 0) return;
          e.preventDefault();
          stepIncrement(e.deltaY > 0 ? -1 : 1);
        }
      : null;
  const wheelRef = useNonPassiveWheel<HTMLInputElement>(
    exchangeStep?.onWheel ?? incrementWheel
  );

  function stepButton(direction: 1 | -1) {
    if (exchangeOddsStepping) {
      onChange(stepExchangeOdds(value, direction > 0 ? "up" : "down"));
      return;
    }
    if (increment != null) {
      stepIncrement(direction);
      return;
    }
    const base = Number.isFinite(value) ? value : (min ?? 0);
    const next = roundPence(base + direction * step);
    onChange(min != null ? Math.max(min, next) : next);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">{label}</span>
      <span className="relative">
        {prefix && (
          <span
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-black/45 dark:text-white/50",
              density === "compact" ? "text-sm" : "text-base"
            )}
          >
            {prefix}
          </span>
        )}
        <input
          ref={wheelRef}
          type="number"
          inputMode="decimal"
          step={exchangeOddsStepping ? "any" : increment ?? step}
          min={min}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) =>
            exchangeOddsStepping
              ? handleExchangeOddsInputEvent(value, e, onChange)
              : onChange(parseFloat(e.target.value))
          }
          onKeyDown={(e) => {
            if (exchangeStep) {
              exchangeStep.onKeyDown(e);
              return;
            }
            if (increment == null) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              stepIncrement(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              stepIncrement(-1);
            }
          }}
          className={cn(
            "w-full rounded-md border-0 bg-[var(--pi)] px-3 font-bold tabular-nums text-black/85 outline-none ring-primary/40 [appearance:textfield] placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            density === "compact"
              ? "h-9 text-sm placeholder:text-sm"
              : "h-11 text-lg placeholder:text-base",
            fieldControlShadow,
            PANEL_TINT_TRANSITION,
            prefix && (density === "compact" ? "pl-7" : "pl-8"),
            suffix ? "pr-16" : "pr-9",
            disabled && "opacity-60",
            inputClassName
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 text-base font-bold text-black/60 dark:text-white/70">
            {suffix}
          </span>
        )}
        <NumberStepperButtons
          onStepUp={() => stepButton(1)}
          onStepDown={() => stepButton(-1)}
          disabled={disabled}
          density={density}
          fieldRadius="var(--radius-md)"
        />
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
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-lg font-bold text-black/85 outline-none ring-primary/40 placeholder:text-base placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40",
          fieldControlShadow,
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
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-md border-0 bg-[var(--pi)] px-3 text-base font-semibold text-black/85 outline-none ring-primary/40 placeholder:text-base placeholder:font-medium placeholder:text-black/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/40",
          fieldControlShadow,
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  selectClassName?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">{label}</span>
      <span className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-md border-0 bg-[var(--pi)] py-0 pl-3 pr-10 text-lg font-bold text-black/85 outline-none ring-primary/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95",
            PANEL_TINT_TRANSITION,
            disabled && "opacity-60",
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
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">{label}</span>
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

/** Editable lay stake — exchange penny grid, always 2 dp when idle. */
function LayStakeInput({
  label,
  value,
  onChange,
  pending,
  density = "default",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  /** Plan is not ready: show empty, and do not commit a £0 override on blur. */
  pending?: boolean;
  density?: "default" | "compact";
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const stakeStep = layStakeStepHandlers(value, (next) => {
    setText(formatLayStake(next));
    setDirty(true);
    onChange(next);
  });
  const wheelRef = useNonPassiveWheel<HTMLInputElement>(stakeStep.onWheel);

  // While unfocused the display derives straight from `value`, and onFocus
  // seeds `text` fresh - no sync effect needed.
  const display = focused
    ? text
    : pending || !Number.isFinite(value)
      ? ""
      : formatLayStake(value);

  function commitText(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(Number.NaN);
      return;
    }
    const n = parseFloat(trimmed.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 0) {
      onChange(commitLayStake(n));
    }
  }

  return (
    <input
      ref={wheelRef}
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder="0.00"
      value={display}
      onFocus={() => {
        setFocused(true);
        setDirty(false);
        setText(pending || !Number.isFinite(value) || value === 0 ? "" : formatLayStake(value));
      }}
      onBlur={() => {
        setFocused(false);
        if (dirty) commitText(text);
        setDirty(false);
      }}
      onKeyDown={stakeStep.onKeyDown}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        setDirty(true);
        if (next.trim() === "") {
          onChange(Number.NaN);
          return;
        }
        const n = parseFloat(next.replace(/,/g, ""));
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      className={cn(
        "w-full rounded-md border border-black/15 bg-[var(--pi)] pr-10 tabular-nums text-black/85 outline-none ring-primary/40 placeholder:text-black/30 focus:ring-2",
        density === "compact"
          ? "h-9 pl-7 text-sm font-bold"
          : "h-11 pl-8 text-lg font-extrabold",
        "dark:border-white/12 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:placeholder:text-white/30",
        PANEL_TINT_TRANSITION
      )}
    />
  );
}

/** Lay stake field — Add bet well, optional liability under the input. */
export function LayStakeBanner({
  label = "Lay stake",
  value,
  liability,
  onChange,
  pending,
  trailing = "copy",
  density = "default",
}: {
  label?: string;
  value: number;
  /** Exchange liability, shown under the field so Odds | Stake stay aligned */
  liability?: number;
  /** When set, the field is overridable (Add bet / calculators) */
  onChange?: (v: number) => void;
  /** Hide a £0 auto value until back stake and both odds are in */
  pending?: boolean;
  /** Main lay stake copies the slip; part-lay rows use inset steppers. */
  trailing?: "copy" | "steppers";
  /** `compact` is h-9 (Advanced strip). */
  density?: "default" | "compact";
}) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-black/60 dark:text-white/70">
        {label}
      </span>
      <span className="relative min-w-0">
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-semibold text-black/45 dark:text-white/50",
            density === "compact" ? "text-sm" : "text-base"
          )}
        >
          £
        </span>
        {onChange ? (
          <LayStakeInput
            label={label}
            value={value}
            onChange={onChange}
            pending={pending}
            density={density}
          />
        ) : (
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            readOnly
            value={
              pending || !Number.isFinite(value) ? "" : formatLayStake(value)
            }
            className={cn(
              "w-full rounded-md border border-black/15 bg-[var(--pi)] pr-10 tabular-nums text-black/85 outline-none",
              density === "compact"
                ? "h-9 pl-7 text-sm font-bold"
                : "h-11 pl-8 text-lg font-extrabold",
              "dark:border-white/12 dark:bg-[var(--pi-dark)] dark:text-white/95",
              PANEL_TINT_TRANSITION
            )}
          />
        )}
        {trailing === "steppers" && onChange ? (
          <NumberStepperButtons
            density={density}
            onStepUp={() => onChange(stepLayStake(value, "up"))}
            onStepDown={() => onChange(stepLayStake(value, "down"))}
          />
        ) : (
          <button
            type="button"
            aria-label="Copy lay stake"
            className="absolute top-1/2 right-2 mr-1 -translate-y-1/2 text-black/45 transition-colors hover:text-black/80 dark:text-white/50 dark:hover:text-white"
            onClick={() => {
              navigator.clipboard.writeText(
                Number.isFinite(value) ? value.toFixed(2) : "0.00"
              );
              toast.success("Lay stake copied", {
                description: `£${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`,
              });
            }}
          >
            <Copy className="size-4" />
          </button>
        )}
      </span>
      {liability != null && Number.isFinite(liability) ? (
        <span className="text-xs font-medium text-black/55 dark:text-white/65">
          Liability{" "}
          <span className="tabular-nums font-semibold text-black/75 dark:text-white/85">
            £{liability.toFixed(2)}
          </span>
        </span>
      ) : null}
    </label>
  );
}

export interface OutcomeRow {
  label: string;
  bookie: number;
  exchange: number;
  accent?: "back" | "lay" | "edge";
  /**
   * Stake vs refund (or similar credit) that compose `bookie`.
   * Rendered above the net so risk-free retention is visible in the table.
   */
  bookieBreakdown?: BookieBreakdownLine[] | null;
}

function BookieCell({
  net,
  breakdown,
}: {
  net: number;
  breakdown?: BookieBreakdownLine[] | null;
}) {
  if (!breakdown?.length) {
    return <MoneyFlow value={net} signColor signDisplay />;
  }
  const summary = [
    ...breakdown.map((line) => `${formatGbp(line.value, { signed: true })} ${line.label}`),
    `net ${formatGbp(net, { signed: true })}`,
  ].join(", ");
  return (
    <div
      role="group"
      aria-label={`Bookie: ${summary}`}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5"
    >
      {breakdown.map((line) => (
        <Fragment key={line.label}>
          <span className="min-w-0 text-pretty break-words text-left text-xs font-medium leading-tight text-muted-foreground">
            {line.label}
          </span>
          <MoneyFlow
            value={line.value}
            signColor
            signDisplay
            className="text-xs font-medium"
          />
        </Fragment>
      ))}
      <span className="col-span-2 mt-0.5 block h-px bg-border/80" aria-hidden />
      <span className="text-left text-xs font-medium leading-tight text-muted-foreground">
        net
      </span>
      <MoneyFlow value={net} signColor signDisplay />
    </div>
  );
}

/**
 * MBB-style settlement table: coloured chevron row labels (green back / blue
 * lay, or the selected exchange's colours), Bookie | Exchange | = Total.
 */
export const ProfitTable = memo(function ProfitTable({
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
  const brandOverride = useVenueBrandOverride(venue);
  const ready = useSettledPanelTint();
  const backPlate = resolveBackPlateColors(venue, exchange, brandOverride);
  const layPlate = resolveLayPlateColors(exchange);
  const backBase = ready ? backPlate.light : null;
  const layBase = ready ? layPlate.light : null;
  const backDark = ready ? backPlate.dark : null;
  const layDark = ready ? layPlate.dark : null;
  return (
    <NumberFlowGroup>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0 max-w-full overflow-hidden rounded-lg border">
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
                const isEdge = row.accent === "edge";
                const isBack = !isEdge && row.accent !== "lay";
                const accent = isBack ? backBase : layBase;
                const accentDark = isBack ? backDark : layDark;
                const chevVars = panelTintVars(accent, accentDark);
                const chevText =
                  accent && /^#/.test(accent) ? contrastText(accent) : "#1a1a1a";
                return (
                  <tr
                    key={row.label}
                    className={cn("border-t", row.bookieBreakdown?.length ? "h-px" : "")}
                  >
                    <td className={cn("min-w-0 py-2 pr-3", row.bookieBreakdown?.length ? "h-full align-top" : "")}>
                      <span
                        className={cn(
                          "flex min-h-9 min-w-0 items-center py-1 pl-3 pr-6 text-[13px] font-bold leading-tight text-pretty break-words",
                          isEdge
                            ? "bg-edge text-edge-foreground"
                            : "bg-[var(--chev)] text-[var(--chev-text)] dark:bg-[var(--chev-dark)] dark:text-white/95",
                          row.bookieBreakdown?.length ? "h-full" : "",
                          PANEL_TINT_TRANSITION
                        )}
                        style={
                          {
                            clipPath:
                              "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                            ...(isEdge
                              ? {}
                              : {
                                  "--chev": chevVars["--panel"],
                                  "--chev-dark": chevVars["--panel-dark"],
                                  "--chev-text": chevText,
                                }),
                          } as React.CSSProperties
                        }
                      >
                        {row.label}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "min-w-0 px-3 text-right text-[15px] font-semibold tabular-nums",
                        row.bookieBreakdown?.length ? "align-top py-2" : "py-2.5"
                      )}
                    >
                      <BookieCell net={row.bookie} breakdown={row.bookieBreakdown} />
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right text-[15px] font-semibold tabular-nums",
                        row.bookieBreakdown?.length ? "align-bottom" : ""
                      )}
                    >
                      <MoneyFlow value={row.exchange} signColor signDisplay />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-right text-[15px] font-extrabold tabular-nums",
                        row.bookieBreakdown?.length ? "align-bottom" : ""
                      )}
                    >
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
    </NumberFlowGroup>
  );
});
