"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { enGB as dayPickerEnGB } from "react-day-picker/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FilterPill } from "@/components/ui/filter-pill";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { filterPillGroup } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Parse YYYY-MM-DD as a local calendar day (no UTC shift). */
export function parseYmdLocal(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD in local calendar terms. */
export function formatYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local calendar day offset from today (midnight-based, no UTC shift). */
export function ymdDaysFromToday(days: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return formatYmdLocal(d);
}

/**
 * Shared date field: shadcn Popover + react-day-picker Calendar.
 * Value is always YYYY-MM-DD (or empty), matching previous native `type="date"` inputs.
 *
 * Uses PopoverAnchor (not Trigger) so the control stays on the PressButton path
 * and matches sibling outline buttons for height / face / press.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
  disabled,
  size = "default",
  captionLayout = "dropdown",
  fromYear,
  toYear,
  /** Ending/expiry fields: Tomorrow + 7 days chips under the calendar. */
  shortcuts,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Matches Button size tokens — use `lg` (h-9) beside page header actions. */
  size?: "default" | "sm" | "lg";
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  fromYear?: number;
  toYear?: number;
  shortcuts?: "ending";
}) {
  const [open, setOpen] = useState(false);
  const selected = parseYmdLocal(value);
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 5;
  const endYear = toYear ?? now.getFullYear() + 2;
  const tomorrowYmd = ymdDaysFromToday(1, now);
  const inSevenYmd = ymdDaysFromToday(7, now);

  function pickShortcut(ymd: string) {
    onChange(ymd);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span className={cn("inline-flex", className)}>
          <Button
            id={id}
            type="button"
            variant="outline"
            size={size}
            disabled={disabled}
            data-empty={!selected}
            className={cn(
              "w-full justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
              size === "lg" ? "px-3" : "px-2.5"
            )}
            onClick={() => setOpen((prev) => !prev)}
          >
            <CalendarIcon
              className={cn(
                "shrink-0 text-muted-foreground",
                size === "lg" ? "size-4" : "size-3.5"
              )}
            />
            {selected ? format(selected, "d MMM yyyy", { locale: enGB }) : placeholder}
          </Button>
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={dayPickerEnGB}
          captionLayout={captionLayout}
          startMonth={new Date(startYear, 0)}
          endMonth={new Date(endYear, 11)}
          selected={selected}
          defaultMonth={selected ?? now}
          onSelect={(date) => {
            if (!date) {
              onChange("");
              return;
            }
            onChange(formatYmdLocal(date));
            setOpen(false);
          }}
        />
        {shortcuts === "ending" ? (
          <div className={cn(filterPillGroup, "border-t px-2 py-2")}>
            <FilterPill
              compact
              active={value === tomorrowYmd}
              onClick={() => pickShortcut(tomorrowYmd)}
            >
              Tomorrow
            </FilterPill>
            <FilterPill
              compact
              active={value === inSevenYmd}
              onClick={() => pickShortcut(inSevenYmd)}
            >
              7 days
            </FilterPill>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
