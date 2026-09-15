"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepperButtons } from "@/components/ui/number-stepper-buttons";
import { useNonPassiveWheel } from "@/hooks/use-non-passive-wheel";
import { darken } from "@/lib/brands/exchanges";
import {
  exchangeOddsStepHandlers,
  handleExchangeOddsInputEvent,
  stepExchangeOdds,
} from "@/lib/calc/exchange-odds-step";
import {
  commitLayStake,
  formatLayStake,
  layStakeStepHandlers,
  stepLayStake,
} from "@/lib/calc/exchange-stake-step";
import { formatMoneyAmount, roundMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  hint?: string;
  className?: string;
  /** Shown when the field is empty (value NaN) */
  placeholder?: string;
  /** Optional brand tint (e.g. the selected exchange's lay colour) */
  tint?: string;
  /** Extra node rendered to the right of the label */
  labelExtra?: React.ReactNode;
  /** Applied to the input value only (prefix stays neutral unless prefixClassName is set) */
  inputClassName?: string;
  /** Applied to the prefix (defaults to muted) */
  prefixClassName?: string;
  disabled?: boolean;
  /** Exchange tick ladder on arrows / spinner. Typed prices stay as entered. */
  exchangeOddsStepping?: boolean;
  /** Exchange penny grid + always 2 dp. Use on every lay-stake field. */
  layStakeStepping?: boolean;
}

/**
 * Numeric field. Money (`prefix` £) and lay-stake fields idle at two decimal
 * places. Lay-odds fields keep typed prices; arrows follow the exchange ladder.
 */
export function NumField({
  label,
  value,
  onChange,
  step,
  min,
  prefix,
  hint,
  className,
  placeholder,
  tint,
  labelExtra,
  inputClassName,
  prefixClassName,
  disabled,
  exchangeOddsStepping,
  layStakeStepping,
}: NumFieldProps) {
  const id = useId();
  const isMoney = prefix === "£" || layStakeStepping;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  const oddsStep =
    !disabled && exchangeOddsStepping
      ? exchangeOddsStepHandlers(value, onChange)
      : null;
  const stakeStep =
    !disabled && layStakeStepping
      ? layStakeStepHandlers(value, onChange)
      : null;
  const wheelRef = useNonPassiveWheel<HTMLInputElement>(
    oddsStep?.onWheel ?? stakeStep?.onWheel
  );

  function stepField(direction: 1 | -1) {
    if (exchangeOddsStepping) {
      onChange(stepExchangeOdds(value, direction > 0 ? "up" : "down"));
      return;
    }
    if (layStakeStepping) {
      onChange(stepLayStake(value, direction > 0 ? "up" : "down"));
      return;
    }
    const base = Number.isFinite(value) ? value : (min ?? 0);
    const next = roundMoney(base + direction * (step ?? 0.01));
    onChange(min != null ? Math.max(min, next) : next);
  }

  const moneyDisplay = focused
    ? text
    : Number.isFinite(value)
      ? layStakeStepping
        ? formatLayStake(value)
        : formatMoneyAmount(value)
      : "";

  function commitMoneyText(raw: string) {
    const trimmed = raw.replace(/,/g, "").trim();
    if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
      onChange(NaN);
      return;
    }
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) {
      onChange(NaN);
      return;
    }
    onChange(layStakeStepping ? commitLayStake(n) : roundMoney(n));
  }

  const tintStyle = tint
    ? ({ "--nf": tint, "--nf-dark": darken(tint, 0.55) } as React.CSSProperties)
    : undefined;
  const fieldClass = cn(
    "tabular-nums pr-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    prefix && "pl-7",
    tint && "border-0 bg-[var(--nf)] font-semibold dark:bg-[var(--nf-dark)]",
    inputClassName
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        {labelExtra}
      </span>
      <div className="relative">
        {prefix && (
          <span
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground",
              prefixClassName
            )}
          >
            {prefix}
          </span>
        )}
        {exchangeOddsStepping ? (
          <Input
            id={id}
            ref={wheelRef}
            type="number"
            inputMode="decimal"
            step="any"
            min={min ?? 1.01}
            value={Number.isFinite(value) ? value : ""}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={oddsStep?.onKeyDown}
            onChange={(e) => handleExchangeOddsInputEvent(value, e, onChange)}
            className={fieldClass}
            style={tintStyle}
          />
        ) : isMoney ? (
          <Input
            id={id}
            ref={wheelRef}
            type="text"
            inputMode="decimal"
            value={moneyDisplay}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => {
              setFocused(true);
              setText(
                Number.isFinite(value)
                  ? layStakeStepping
                    ? formatLayStake(value)
                    : formatMoneyAmount(value)
                  : ""
              );
            }}
            onBlur={() => {
              setFocused(false);
              commitMoneyText(text);
            }}
            onKeyDown={stakeStep?.onKeyDown}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              const n = parseFloat(next.replace(/,/g, ""));
              if (Number.isFinite(n)) onChange(n);
              else if (next.trim() === "") onChange(NaN);
            }}
            className={fieldClass}
            style={tintStyle}
          />
        ) : (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={Number.isFinite(value) ? value : ""}
            placeholder={placeholder}
            step={step ?? 0.01}
            min={min}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className={fieldClass}
            style={tintStyle}
          />
        )}
        <NumberStepperButtons
          onStepUp={() => stepField(1)}
          onStepDown={() => stepField(-1)}
          disabled={disabled}
          fieldRadius="var(--radius-button)"
        />
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
