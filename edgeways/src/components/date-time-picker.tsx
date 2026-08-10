"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { enGB as dayPickerEnGB } from "react-day-picker/locale";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatYmdLocal,
  parseYmdLocal,
} from "@/components/date-picker";
import { parseHm, TimeWheels } from "@/components/time-picker";
import { formatClockTime } from "@/lib/time-format";
import { cn } from "@/lib/utils";

/** Split datetime-local `YYYY-MM-DDTHH:mm` into date + time parts. */
export function splitDatetimeLocal(value: string): { date: string; time: string } {
  if (!value.trim()) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

/** Join YYYY-MM-DD + HH:mm into datetime-local (empty date → ""). */
export function joinDatetimeLocal(date: string, time: string): string {
  const d = date.trim();
  if (!d) return "";
  const hm = parseHm(time);
  return `${d}T${hm ? `${hm.hour}:${hm.minute}` : "12:00"}`;
}

function parseDatetimeLocal(value: string): Date | null {
  const { date, time } = splitDatetimeLocal(value);
  const day = parseYmdLocal(date);
  const hm = parseHm(time);
  if (!day || !hm) return null;
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(hm.hour),
    Number(hm.minute)
  );
}

function nowHm(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDatetimeLabel(value: string, emptyLabel: string): string {
  const dt = parseDatetimeLocal(value);
  if (!dt) return emptyLabel;
  return `${format(dt, "EEE d MMM", { locale: enGB })}, ${formatClockTime(dt)}`;
}

/**
 * Combined date + time picker (Add bet calendar + iOS time wheels) in one popover.
 * Value is datetime-local `YYYY-MM-DDTHH:mm` or empty.
 */
export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  className,
  /** Icon-only trigger (Acca leg start time); default is a labelled outline field. */
  trigger = "field",
  placeholder = "Pick date & time",
  /** Empty-state aria/tooltip label (icon trigger) and field placeholder fallback. */
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  trigger?: "field" | "icon";
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const parts = splitDatetimeLocal(value);
  const parsedTime = parseHm(parts.time);
  const [draftDate, setDraftDate] = useState(parts.date);
  const [hour, setHour] = useState(parsedTime?.hour ?? "12");
  const [minute, setMinute] = useState(parsedTime?.minute ?? "00");
  const vacantLabel = emptyLabel ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    queueMicrotask(() => {
      const next = splitDatetimeLocal(value);
      setDraftDate(next.date || formatYmdLocal(now));
      const hm = parseHm(next.time) ?? parseHm(nowHm(now))!;
      setHour(hm.hour);
      setMinute(hm.minute);
    });
  }, [open, value]);

  const draftSelected = parseYmdLocal(draftDate);
  const set = Boolean(parseDatetimeLocal(value));
  const label = formatDatetimeLabel(value, vacantLabel);

  function commitWheels(nextHour: string, nextMinute: string) {
    setHour(nextHour);
    setMinute(nextMinute);
  }

  function apply(nextDate: string, nextHour: string, nextMinute: string) {
    onChange(joinDatetimeLocal(nextDate, `${nextHour}:${nextMinute}`));
  }

  function handleDone() {
    const date = draftDate || formatYmdLocal(new Date());
    apply(date, hour, minute);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  function handleToday() {
    const today = formatYmdLocal(new Date());
    setDraftDate(today);
  }

  const panel = (
    <PopoverContent
      align="end"
      className="w-auto gap-0 p-0"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col sm:flex-row">
        <Calendar
          mode="single"
          locale={dayPickerEnGB}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 1, 0)}
          endMonth={new Date(new Date().getFullYear() + 2, 11)}
          selected={draftSelected}
          defaultMonth={draftSelected ?? new Date()}
          onSelect={(date) => {
            if (!date) return;
            setDraftDate(formatYmdLocal(date));
          }}
        />
        <div className="flex flex-col justify-center border-t px-3 py-2 sm:border-l sm:border-t-0">
          <p className="mb-1 text-center text-xs font-medium text-muted-foreground">
            Time
          </p>
          <TimeWheels
            hour={hour}
            minute={minute}
            active={open}
            onChange={commitWheels}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleClear}
        >
          Clear
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleToday}
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </div>
    </PopoverContent>
  );

  if (trigger === "icon") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  id={id}
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled}
                  aria-label={label}
                  className={cn(
                    "size-9 shrink-0",
                    set && "border-primary/40 bg-primary/10 text-primary-text",
                    className
                  )}
                >
                  {set ? (
                    <CalendarCheck className="size-4" />
                  ) : (
                    <CalendarClock className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {panel}
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!set}
          className={cn(
            "w-full justify-start px-2.5 font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          {set ? (
            <CalendarCheck className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {set ? label : placeholder}
        </Button>
      </PopoverTrigger>
      {panel}
    </Popover>
  );
}
