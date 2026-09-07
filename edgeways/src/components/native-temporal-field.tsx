"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Native pickers sometimes emit seconds (`HH:mm:ss` / `…T…:ss`). Storage is `HH:mm`. */
export function normalizeTemporalValue(
  type: "date" | "time" | "datetime-local",
  value: string
): string {
  const raw = value.trim();
  if (!raw) return "";
  if (type === "date") return raw.slice(0, 10);
  if (type === "time") return raw.slice(0, 5);
  const [date = "", time = ""] = raw.split("T");
  if (!date) return "";
  return `${date}T${time.slice(0, 5)}`;
}

/** Brand ring on the chrome when the overlay input is focused. */
export const nativeTemporalFocusWithin =
  "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50";

export function openNativePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled) return;
  try {
    input.showPicker();
  } catch {
    input.focus();
    input.click();
  }
}

export function AdaptiveTemporalPicker({
  prefersNative,
  custom,
  native,
}: {
  prefersNative: boolean | null;
  custom: ReactNode;
  native: ReactNode;
}) {
  if (prefersNative === true) return native;
  if (prefersNative === false) return custom;
  return (
    <>
      <div className="picker-custom">{custom}</div>
      <div className="picker-native">{native}</div>
    </>
  );
}

/**
 * Styled field that opens the OS date / time / datetime picker.
 * The native control is a full-hit overlay so iOS and Android can scroll it.
 */
export function NativeTemporalField({
  type,
  value,
  onChange,
  displayLabel,
  placeholder,
  icon,
  id,
  disabled,
  className,
  min,
  max,
  allowClear = false,
  size = "default",
  tone = "field",
  "aria-label": ariaLabel,
}: {
  type: "date" | "time" | "datetime-local";
  value: string;
  onChange: (value: string) => void;
  displayLabel: string | null;
  placeholder: string;
  icon: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
  allowClear?: boolean;
  size?: "default" | "sm" | "lg";
  tone?: "field" | "toolbar";
  "aria-label"?: string;
}) {
  const empty = !value;
  const label = ariaLabel
    ? displayLabel
      ? `${ariaLabel}, ${displayLabel}`
      : ariaLabel
    : undefined;

  const field = (
    <label
      className={cn(
        buttonVariants({
          variant: tone === "toolbar" ? "ghost" : "outline",
          size: tone === "toolbar" ? "default" : size,
        }),
        "relative",
        nativeTemporalFocusWithin,
        tone === "toolbar"
          ? "h-8 w-auto rounded-full border-transparent bg-transparent px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[empty=false]:bg-muted/60 data-[empty=false]:text-foreground"
          : size === "lg"
            ? "w-auto px-3"
            : "w-full px-2.5",
        tone !== "toolbar" &&
          "justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
        disabled && "pointer-events-none opacity-70",
        allowClear && !empty && "min-w-0 flex-1",
        className
      )}
      data-empty={empty}
    >
      {icon}
      <span className="min-w-0 truncate">{displayLabel ?? placeholder}</span>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        step={type === "date" ? undefined : 60}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(normalizeTemporalValue(type, event.target.value))}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-0 z-10 cursor-pointer text-base opacity-[0.01] outline-none"
      />
    </label>
  );

  if (!allowClear || empty) return field;

  return (
    <div className="flex w-full min-w-0 items-center gap-0.5">
      {field}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={
          type === "time"
            ? "Clear time"
            : type === "datetime-local"
              ? "Clear date and time"
              : "Clear date"
        }
        className={cn(
          tone === "toolbar" && "rounded-full text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("")}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
