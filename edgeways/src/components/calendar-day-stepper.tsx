"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker, formatYmdLocal } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { clampCalendarYmd, isCalendarYmd, shiftCalendarYmd } from "@/lib/events";
import {
  calendarDayStepperTriggerWidth,
  toolbarControlH,
  toolbarIconBox,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function CalendarDayStepper({
  day,
  onChange,
  min,
  max,
  disabled = false,
  busy = false,
  selectedLabel,
  ariaLabel = "Day",
  pickAriaLabel = "Pick a day",
  fromYear,
  toYear,
  stretch = false,
}: {
  day: string;
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Day request in flight. Chevrons stay clickable; chrome reads as busy. */
  busy?: boolean;
  selectedLabel: string;
  ariaLabel?: string;
  pickAriaLabel?: string;
  fromYear?: number;
  toYear?: number;
  /** Fill the parent (pin rail). Chevrons stay 32px; the date field grows. */
  stretch?: boolean;
}) {
  const atMin = min != null && day <= min;
  const atMax = max != null && day >= max;

  function commit(next: string) {
    const lo = min ?? next;
    const hi = max ?? next;
    const clamped = clampCalendarYmd(next, lo, hi);
    if (clamped !== day) onChange(clamped);
  }

  return (
    <div
      className={cn("flex items-center gap-1", stretch && "w-full")}
      role="group"
      aria-label={ariaLabel}
      aria-busy={disabled || busy}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-haspopup={false}
        aria-label="Previous day"
        disabled={disabled || atMin}
        onClick={() => commit(shiftCalendarYmd(day, -1))}
        className={toolbarIconBox}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <DatePicker
        value={day}
        onChange={commit}
        selectedLabel={selectedLabel}
        aria-label={pickAriaLabel}
        captionLayout="dropdown"
        fromYear={fromYear}
        toYear={toYear}
        min={min}
        max={max}
        isDayDisabled={(date) => {
          const ymd = formatYmdLocal(date);
          if (!isCalendarYmd(ymd)) return true;
          if (min && ymd < min) return true;
          if (max && ymd > max) return true;
          return false;
        }}
        className={cn(
          stretch ? "min-w-0 flex-1" : calendarDayStepperTriggerWidth,
          toolbarControlH,
          "justify-center px-2 max-sm:px-2"
        )}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-haspopup={false}
        aria-label="Next day"
        disabled={disabled || atMax}
        onClick={() => commit(shiftCalendarYmd(day, 1))}
        className={toolbarIconBox}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
