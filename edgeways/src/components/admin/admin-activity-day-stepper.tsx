"use client";

import { CalendarDayStepper } from "@/components/calendar-day-stepper";
import { activityDayLabel, londonYmd } from "@/lib/admin/activity-day";

export function AdminActivityDayStepper({
  day,
  onChange,
  disabled = false,
}: {
  day: string;
  onChange: (ymd: string) => void;
  disabled?: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const fromYear = thisYear - 2;
  return (
    <CalendarDayStepper
      day={day}
      onChange={onChange}
      min={`${fromYear}-01-01`}
      max={londonYmd()}
      disabled={disabled}
      selectedLabel={activityDayLabel(day)}
      ariaLabel="Category day"
      pickAriaLabel="Pick category day"
      fromYear={fromYear}
      toYear={thisYear}
    />
  );
}
