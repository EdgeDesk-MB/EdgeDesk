"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { enGB as dayPickerEnGB } from "react-day-picker/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/**
 * Shared date field: shadcn Popover + react-day-picker Calendar.
 * Value is always YYYY-MM-DD (or empty), matching previous native `type="date"` inputs.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  id,
  disabled,
  captionLayout = "dropdown",
  fromYear,
  toYear,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  fromYear?: number;
  toYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseYmdLocal(value);
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 5;
  const endYear = toYear ?? now.getFullYear() + 2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "w-full justify-start px-2.5 text-left font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
          {selected ? format(selected, "d MMM yyyy", { locale: enGB }) : placeholder}
        </Button>
      </PopoverTrigger>
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
      </PopoverContent>
    </Popover>
  );
}
