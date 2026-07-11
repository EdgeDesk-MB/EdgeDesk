"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Native time input - same shell and behaviour as the date field (`type="date"`). */
export function EventTimeInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Input
      type="time"
      step={60}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "tabular-nums appearance-none [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer",
        className
      )}
    />
  );
}
