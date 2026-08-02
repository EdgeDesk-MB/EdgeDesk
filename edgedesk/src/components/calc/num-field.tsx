"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { darken } from "@/lib/brands/exchanges";
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
}

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
}: NumFieldProps) {
  const id = useId();
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
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          placeholder={placeholder}
          step={step ?? 0.01}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            "tabular-nums",
            prefix && "pl-7",
            tint && "border-0 bg-[var(--nf)] font-semibold dark:bg-[var(--nf-dark)]",
            inputClassName
          )}
          style={
            tint ? ({ "--nf": tint, "--nf-dark": darken(tint, 0.55) } as React.CSSProperties) : undefined
          }
        />
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
