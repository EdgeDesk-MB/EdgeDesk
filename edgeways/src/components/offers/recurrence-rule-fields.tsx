"use client";

/**
 * Shared recurrence rule editor used by sports offer create and casino log (K3).
 * Rule grammar stays in offer-recurrence-shared; this is presentation only.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterPill } from "@/components/ui/filter-pill";
import type { OfferRecurrenceFreq, OfferRecurrenceRule } from "@/lib/services/offers.types";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type RecurrenceRuleFieldsValue = {
  freq: OfferRecurrenceFreq;
  interval: string;
  weekdays: number[];
  monthday: string;
};

export const DEFAULT_RECURRENCE_FIELDS: RecurrenceRuleFieldsValue = {
  freq: "daily",
  interval: "1",
  weekdays: [new Date().getDay()],
  monthday: "1",
};

export function buildRecurrenceRule(
  fields: RecurrenceRuleFieldsValue,
  extras?: { expiryOffsetDays?: number }
): OfferRecurrenceRule {
  const interval = Math.max(1, parseInt(fields.interval, 10) || 1);
  return {
    freq: fields.freq,
    interval,
    ...(fields.freq === "weekly"
      ? {
          byWeekday:
            fields.weekdays.length > 0 ? fields.weekdays : [new Date().getDay()],
        }
      : {}),
    ...(fields.freq === "monthly"
      ? {
          byMonthday: Math.min(31, Math.max(1, parseInt(fields.monthday, 10) || 1)),
        }
      : {}),
    ...(extras?.expiryOffsetDays != null ? { expiryOffsetDays: extras.expiryOffsetDays } : {}),
  };
}

export function RecurrenceRuleFields({
  value,
  onChange,
  helpText,
}: {
  value: RecurrenceRuleFieldsValue;
  onChange: (next: RecurrenceRuleFieldsValue) => void;
  helpText?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Frequency</Label>
          <Select
            value={value.freq}
            onValueChange={(v) => onChange({ ...value, freq: v as OfferRecurrenceFreq })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="recurrence-interval" className="text-xs text-muted-foreground">
            Every
          </Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="recurrence-interval"
              type="number"
              min={1}
              className="w-16"
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">
              {value.freq === "daily"
                ? "day(s)"
                : value.freq === "weekly"
                  ? "week(s)"
                  : "month(s)"}
            </span>
          </div>
        </div>
      </div>

      {value.freq === "weekly" ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">On</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, day) => {
              const active = value.weekdays.includes(day);
              return (
                <FilterPill
                  key={day}
                  active={active}
                  onClick={() => {
                    if (active) {
                      const next = value.weekdays.filter((d) => d !== day);
                      onChange({
                        ...value,
                        weekdays: next.length > 0 ? next : value.weekdays,
                      });
                    } else {
                      onChange({
                        ...value,
                        weekdays: [...value.weekdays, day].sort(),
                      });
                    }
                  }}
                >
                  {label}
                </FilterPill>
              );
            })}
          </div>
        </div>
      ) : null}

      {value.freq === "monthly" ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="recurrence-monthday" className="text-xs text-muted-foreground">
            Day of month
          </Label>
          <Input
            id="recurrence-monthday"
            type="number"
            min={1}
            max={31}
            className="w-20"
            value={value.monthday}
            onChange={(e) => onChange({ ...value, monthday: e.target.value })}
          />
        </div>
      ) : null}

      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
    </div>
  );
}
