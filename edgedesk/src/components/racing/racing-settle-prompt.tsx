"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingSettleRace } from "@/lib/racing/pending-settle";
import { formatClockString } from "@/lib/time-format";
import { AlertCircle, X } from "lucide-react";

const DISMISS_KEY = "edgedesk:settle-prompt-dismissed";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
}

export function RacingSettlePrompt({
  races,
  resultsTier,
  className,
}: {
  races: PendingSettleRace[];
  /** basic = auto results available; free = racecards only; none = no key */
  resultsTier?: "basic" | "free" | "none";
  className?: string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    queueMicrotask(() => setDismissed(loadDismissed()));
  }, []);

  const visible = useMemo(
    () => races.filter((r) => !dismissed.has(r.id)),
    [races, dismissed]
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  function dismissAll() {
    const next = new Set(dismissed);
    for (const race of visible) next.add(race.id);
    setDismissed(next);
    saveDismissed(next);
  }

  const primary = visible[0];
  const moreCount = visible.length - 1;
  const tierHint =
    resultsTier === "basic"
      ? "Results sync automatically while the app is open - or "
      : resultsTier === "free"
        ? "Free tier - upgrade Racing API Basic for auto results, or "
        : "Set Racing API credentials for auto results, or ";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm",
        className
      )}
      role="status"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          {visible.length === 1 ? "Race awaiting result" : `${visible.length} races awaiting results`}
        </p>
        <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
          <span className="font-medium">{primary.course}</span> ({formatClockString(primary.offTime)}) passed off without a
          winner. {tierHint}
          set the winner on{" "}
          <Link href="/tracked-events" className="font-medium underline underline-offset-2">
            Tracked Events
          </Link>
          .
          {moreCount > 0 && (
            <span className="text-amber-700/80 dark:text-amber-300/80">
              {" "}
              +{moreCount} more
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
          <Link href="/tracked-events">Settle</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-amber-700 hover:text-amber-900 dark:text-amber-300"
          aria-label="Dismiss settle reminder"
          onClick={() => (visible.length === 1 ? dismiss(primary.id) : dismissAll())}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
