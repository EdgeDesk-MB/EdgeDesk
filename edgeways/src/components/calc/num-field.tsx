"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { darken } from "@/lib/brands/exchanges";
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
}

/**
 * Numeric field. When `prefix` is £, the idle display is always two decimal
 * places (pounds and pence) - HTML number inputs drop trailing zeros.
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
}: NumFieldProps) {
  const id = useId();
  const isMoney = prefix === "£";
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  const moneyDisplay = focused
    ? text
    : Number.isFinite(value)
      ? formatMoneyAmount(value)
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
    onChange(roundMoney(n));
  }

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
        {isMoney ? (
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            value={moneyDisplay}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => {
              setFocused(true);
              setText(Number.isFinite(value) ? formatMoneyAmount(value) : "");
            }}
            onBlur={() => {
              setFocused(false);
              commitMoneyText(text);
            }}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              const n = parseFloat(next.replace(/,/g, ""));
              if (Number.isFinite(n)) onChange(n);
              else if (next.trim() === "") onChange(NaN);
            }}
            className={cn(
              "tabular-nums",
              prefix && "pl-7",
              tint && "border-0 bg-[var(--nf)] font-semibold dark:bg-[var(--nf-dark)]",
              inputClassName
            )}
            style={
              tint
                ? ({ "--nf": tint, "--nf-dark": darken(tint, 0.55) } as React.CSSProperties)
                : undefined
            }
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
            className={cn(
              "tabular-nums",
              prefix && "pl-7",
              tint && "border-0 bg-[var(--nf)] font-semibold dark:bg-[var(--nf-dark)]",
              inputClassName
            )}
            style={
              tint
                ? ({ "--nf": tint, "--nf-dark": darken(tint, 0.55) } as React.CSSProperties)
                : undefined
            }
          />
        )}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
