"use client";

import { VenueSelect } from "@/components/venue-select";

/** Bookie picker (Settings / Balances). Free-typed names are saved as bookie wallets. */
export function BookieNamePicker({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  /** Omit or pass empty string to hide the inner label (outer field label handles it). */
  label?: string;
  className?: string;
}) {
  return (
    <VenueSelect
      value={value}
      onChange={onChange}
      label={label ?? "Bookie"}
      className={className}
      placeholder="Select bookie"
      kinds={["bookie"]}
    />
  );
}

/** Exchange picker (Settings defaults, balances). Lists exchanges only. */
export function ExchangeNamePicker({
  value,
  onChange,
  label,
  className,
  allowCustom = true,
  compact = false,
  size = "default",
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  className?: string;
  allowCustom?: boolean;
  compact?: boolean;
  /** `sm` = Settings-styled trigger at ThemeSelect height */
  size?: "default" | "sm";
}) {
  return (
    <VenueSelect
      value={value}
      onChange={onChange}
      label={label ?? "Exchange"}
      className={className}
      placeholder="Select exchange"
      kinds={["exchange"]}
      allowCustom={allowCustom}
      compact={compact}
      size={size}
    />
  );
}

export const EXCHANGE_CUSTOM = "__exchange_custom__";
