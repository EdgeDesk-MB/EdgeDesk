"use client";

import { VenueSelect } from "@/components/venue-select";

/**
 * Compact searchable bookmaker / exchange picker (2UP Desk, Add bet).
 * Free-typed names are saved as wallets under Bookies or Exchanges.
 */
export function BookmakerSelect({
  value,
  onChange,
  className,
  preferAvailable = true,
  tagTrigger = false,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  preferAvailable?: boolean;
  /** Add bet Back header: brand tag instead of colour dot + name */
  tagTrigger?: boolean;
}) {
  return (
    <VenueSelect
      value={value}
      onChange={onChange}
      className={className}
      preferAvailable={preferAvailable}
      compact
      tagTrigger={tagTrigger}
      placeholder="Bookie"
    />
  );
}
