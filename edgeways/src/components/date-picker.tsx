"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { enGB as dayPickerEnGB } from "react-day-picker/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FilterPill } from "@/components/ui/filter-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AdaptiveTemporalPicker,
  NativeTemporalField,
} from "@/components/native-temporal-field";
import { usePrefersNativePicker } from "@/hooks/use-prefers-native-picker";
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

/** Native `min` / `max` from year bounds (inclusive calendar years). */
export function yearBoundsToYmdRange(
  fromYear?: number,
  toYear?: number
): { min?: string; max?: string } {
  return {
    min: fromYear != null ? `${fromYear}-01-01` : undefined,
    max: toYear != null ? `${toYear}-12-31` : undefined,
  };
}

/**
 * Shared date field: shadcn Popover + react-day-picker Calendar on fine
 * pointers. Coarse / narrow viewports use the OS `type="date"` picker so
 * the field does not trap scroll inside a dialog popover.
 *
 * Uses PopoverTrigger (like TimePicker) so the field stays on the flat Button path.
 * PressButton/react-3d-button hover translate jitters icon + label in dense forms.
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
  min,
  max,
  /** Ending/expiry fields: Tomorrow + 7 days chips under the calendar. */
  shortcuts,
  isDayDisabled,
  tone = "field",
  allowClear = false,
  hint,
  nativeHint,
  selectedLabel: selectedLabelOverride,
  "aria-label": ariaLabel,
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
  /** Inclusive YYYY-MM-DD bounds for the native picker (and year fallback). */
  min?: string;
  max?: string;
  shortcuts?: "ending";
  /** Grey out calendar days (e.g. days with no tracked events). */
  isDayDisabled?: (date: Date) => boolean;
  /** `toolbar` sits with FilterPills (Campaigns category Select). */
  tone?: "field" | "toolbar";
  allowClear?: boolean;
  hint?: string;
  /** Shown under the OS picker when it cannot enforce calendar-only rules. */
  nativeHint?: string;
  /** Override the trigger text (e.g. Today) while value stays YYYY-MM-DD. */
  selectedLabel?: string;
  "aria-label"?: string;
}) {
  const prefersNative = usePrefersNativePicker();
  const [open, setOpen] = useState(false);
  const selected = parseYmdLocal(value);
  const now = new Date();
  const startYear = fromYear ?? now.getFullYear() - 5;
  const endYear = toYear ?? now.getFullYear() + 2;
  const yearRange = yearBoundsToYmdRange(fromYear, toYear);
  const nativeMin = min ?? yearRange.min;
  const nativeMax = max ?? yearRange.max;
  const tomorrowYmd = ymdDaysFromToday(1, now);
  const inSevenYmd = ymdDaysFromToday(7, now);

  function pickShortcut(ymd: string) {
    onChange(ymd);
    setOpen(false);
  }

  const selectedLabel = selected
    ? selectedLabelOverride ?? format(selected, "d MMM yyyy", { locale: enGB })
    : null;
  const triggerName = ariaLabel
    ? selectedLabel
      ? `${ariaLabel}, ${selectedLabel}`
      : ariaLabel
    : undefined;

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={prefersNative === false ? id : undefined}
          type="button"
          variant={tone === "toolbar" ? "ghost" : "outline"}
          size={tone === "toolbar" ? "default" : size}
          disabled={disabled}
          data-empty={!selected}
          aria-label={triggerName}
          className={cn(
            // Form fields stretch; header `lg` stays content-width so it can
            // sit in a PageHeaderActions row without forcing a wrap.
            tone === "toolbar"
              ? "h-8 w-auto rounded-full border-transparent bg-transparent px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[empty=false]:bg-muted/60 data-[empty=false]:text-foreground"
              : size === "lg"
                ? "w-auto px-3"
                : "w-full px-2.5",
            tone !== "toolbar" &&
              "justify-start font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarIcon
            className={cn(
              "shrink-0",
              tone === "toolbar"
                ? "size-3 text-current"
                : cn(
                    "text-muted-foreground",
                    size === "lg" ? "size-4" : "size-3.5"
                  )
            )}
          />
          <span className="min-w-0 truncate">{selectedLabel ?? placeholder}</span>
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
          disabled={isDayDisabled}
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
        {hint ? (
          <p className="max-w-64 border-t px-3 py-2 text-xs text-pretty text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );

  const custom = !allowClear || !selected ? (
    picker
  ) : (
    <div className="flex items-center gap-0.5">
      {picker}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Clear date"
        className={cn(
          tone === "toolbar" && "rounded-full text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("")}
      >
        <X className="size-3" />
      </Button>
    </div>
  );

  const icon = (
    <CalendarIcon
      className={cn(
        "shrink-0",
        tone === "toolbar"
          ? "size-3 text-current"
          : cn("text-muted-foreground", size === "lg" ? "size-4" : "size-3.5")
      )}
    />
  );

  const native = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <NativeTemporalField
        type="date"
        value={value}
        onChange={onChange}
        displayLabel={selectedLabel}
        placeholder={placeholder}
        icon={icon}
        id={prefersNative !== false ? id : undefined}
        disabled={disabled}
        className={className}
        min={nativeMin}
        max={nativeMax}
        allowClear={allowClear}
        size={size}
        tone={tone}
        aria-label={ariaLabel}
      />
      {shortcuts === "ending" ? (
        <div className={filterPillGroup}>
          <FilterPill
            compact
            active={value === tomorrowYmd}
            onClick={() => onChange(tomorrowYmd)}
          >
            Tomorrow
          </FilterPill>
          <FilterPill
            compact
            active={value === inSevenYmd}
            onClick={() => onChange(inSevenYmd)}
          >
            7 days
          </FilterPill>
        </div>
      ) : null}
      {nativeHint ?? hint ? (
        <p className="max-w-64 text-xs text-pretty text-muted-foreground">
          {nativeHint ?? hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <AdaptiveTemporalPicker
      prefersNative={prefersNative}
      custom={custom}
      native={native}
    />
  );
}
