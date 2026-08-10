"use client";

import { useEffect, useState } from "react";
import {
  ALERT_TOAST_AGE_TICK_MS,
  formatAlertToastAge,
} from "@/lib/alerts/toast-age";
import { sectionDescription } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Sticky toast body + optional "N minutes ago" once the toast is older than
 * five minutes. Age ticks while the toast stays on-screen.
 */
export function EdgeAlertToastDescription({
  body,
  raisedAt,
}: {
  body?: string | null;
  raisedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ALERT_TOAST_AGE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const age = formatAlertToastAge(raisedAt, now);
  const text = body?.trim() ?? "";

  if (!text && !age) return null;

  return (
    <span className="flex max-w-full flex-col items-start gap-1">
      {text ? <span>{text}</span> : null}
      {age ? (
        <time
          className={cn(sectionDescription, "font-normal opacity-80")}
          dateTime={new Date(raisedAt).toISOString()}
        >
          {age}
        </time>
      ) : null}
    </span>
  );
}
