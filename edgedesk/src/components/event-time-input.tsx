"use client";

import { TimePicker } from "@/components/time-picker";

/** Event time field — shared TimePicker (same chrome as DatePicker). */
export function EventTimeInput({
  value,
  onChange,
  className,
  placeholder = "12:00",
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <TimePicker
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}
