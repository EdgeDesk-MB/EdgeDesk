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
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  preferAvailable?: boolean;
}) {
  return (
    <VenueSelect
      value={value}
      onChange={onChange}
      className={className}
      preferAvailable={preferAvailable}
      compact
      placeholder="Bookie"
    />
  );
}
