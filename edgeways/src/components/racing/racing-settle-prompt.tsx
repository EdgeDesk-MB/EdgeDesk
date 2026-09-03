"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingSettleRace } from "@/lib/racing/pending-settle";
import {
  settlePromptCopy,
  type SettlePromptPlacement,
} from "@/lib/racing/settle-prompt-copy";
import { formatClockString } from "@/lib/time-format";
import { AlertCircle, X } from "lucide-react";

const DISMISS_KEY = "edgeways:settle-prompt-dismissed";

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
  placement = "elsewhere",
  onSetResult,
}: {
  races: PendingSettleRace[];
  /** basic = auto results available; free = racecards only; none = no key */
  resultsTier?: "basic" | "free" | "none";
  className?: string;
  /** tracked-events = already on the settle page; skip the self-link. */
  placement?: SettlePromptPlacement;
  /** Opens Set result for the primary race when already on Tracked Events. */
  onSetResult?: (eventId: number) => void;
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
  const copy = settlePromptCopy({
    placement,
    resultsTier,
    pendingCount: visible.length,
  });
  const trackedEventsLink = (
    <Link href="/tracked-events" className="font-medium underline underline-offset-2">
      Tracked Events
    </Link>
  );
  const action =
    copy.actionKind === "set-result-on-page" ? (
      <>use Set result (1st–4th) on {copy.racePhrase}.</>
    ) : (
      <>set the result on {trackedEventsLink}.</>
    );
  const actionCapped =
    copy.actionKind === "set-result-on-page" ? (
      <>Use Set result (1st–4th) on {copy.racePhrase}.</>
    ) : (
      <>Set the result on {trackedEventsLink}.</>
    );

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm",
        className
      )}
      role="status"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-warning">
          {visible.length === 1 ? "Race awaiting result" : `${visible.length} races awaiting results`}
        </p>
        <p className="mt-0.5 text-pretty break-words text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">{primary.course}</strong>
          {" "}
          ({formatClockString(primary.offTime)}) has started.{" "}
          {copy.lead === "auto-sync" ? (
            <>Results sync automatically while the app is open, or {action}</>
          ) : (
            actionCapped
          )}
          {moreCount > 0 && <span> +{moreCount} more</span>}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {copy.actionKind === "set-result-on-page" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (primary.trackedEventId != null) onSetResult?.(primary.trackedEventId);
            }}
          >
            Set result
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href="/tracked-events">Set result</Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-warning hover:text-warning/80"
          aria-label="Dismiss result reminder"
          onClick={() => (visible.length === 1 ? dismiss(primary.id) : dismissAll())}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
