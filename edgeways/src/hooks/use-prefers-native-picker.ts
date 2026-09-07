"use client";

import { useEffect, useState } from "react";

/**
 * Touch, no-hover, or below `md`. Custom calendar / time wheels fight
 * dialog scroll lock on these. Keep in step with `.picker-native` in globals.css.
 *
 * Every date / time field must go through DatePicker, TimePicker /
 * EventTimeInput, or DateTimePicker so this gate applies app-wide.
 */
export const NATIVE_PICKER_QUERY =
  "(any-pointer: coarse), (hover: none), (max-width: 767px)";

/**
 * `null` until mounted. During that window render both pickers and let
 * `.picker-native` / `.picker-custom` in globals.css pick the visible one.
 */
export function usePrefersNativePicker(): boolean | null {
  const [prefers, setPrefers] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(NATIVE_PICKER_QUERY);
    const update = () => setPrefers(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefers;
}
