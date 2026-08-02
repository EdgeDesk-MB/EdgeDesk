"use client";

/**
 * Naked-exposure banner (B5) - in-page contextual warning for open backs with
 * no lay past the threshold. Styled like History settlement rows (inset,
 * rounded tint) rather than a full-bleed strip. One tap marks a bet as
 * intentionally unhedged; "Add lay" deep-links to the tracker row.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  dismissBrowserNotifications,
  suppressAlertKeys,
} from "@/lib/alerts/seen";
import {
  detectNakedExposure,
  markIntentionalNoHedge,
  nakedExposureAlertKey,
} from "@/lib/bets/naked-exposure";
import { cn } from "@/lib/utils";

export function NakedExposureBanner({ className }: { className?: string }) {
  const { state, refresh } = useAppState();
  const [now, setNow] = useState(0);
  const [muting, setMuting] = useState(false);

  // Clock tick keeps threshold checks honest without impure render reads.
  useEffect(() => {
    const update = () => setNow(Date.now());
    queueMicrotask(update);
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const exposed = useMemo(() => {
    if (!state || now === 0) return [];
    const eventStarts = new Map(state.events.map((e) => [e.id, e.startTime]));
    return detectNakedExposure(state.bets, eventStarts, now, {
      thresholdMs: state.settings.tuning.nakedExposureMinutes * 60_000,
      imminentThresholdMs: state.settings.tuning.nakedImminentMinutes * 60_000,
    });
  }, [state, now]);

  if (exposed.length === 0) return null;

  const primary = exposed[0]!;
  const moreCount = exposed.length - 1;

  async function muteIntentional() {
    setMuting(true);
    const alertKey = nakedExposureAlertKey(primary.id);
    // Suppress before the PATCH returns so the next AlertWatcher poll cannot
    // race and toast/push again for a prompt the user has already answered.
    suppressAlertKeys([alertKey]);
    void dismissBrowserNotifications([alertKey]);
    try {
      await api(`/api/bets/${primary.id}`, {
        method: "PATCH",
        json: { notes: markIntentionalNoHedge(primary.notes) },
      });
      // Clear any inbox row that already fired for this bet.
      void api("/api/alerts", {
        method: "PATCH",
        json: { dedupe: alertKey, read: true },
      }).catch(() => {});
      toast.message("Marked intentional", {
        description: `${primary.label} will not alert again.`,
      });
      await refresh?.();
    } catch (e) {
      toast.error("Could not update bet", { description: String(e) });
    } finally {
      setMuting(false);
    }
  }

  return (
    <div className={cn("shrink-0 p-3 sm:p-4", className)}>
      <div
        className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-4 text-sm sm:items-center sm:gap-3"
        role="status"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning sm:mt-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {exposed.length === 1
              ? "Unhedged back bet"
              : `${exposed.length} unhedged back bets`}
          </p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
            <span className="font-medium">{primary.label}</span>
            {primary.bookmaker ? ` at ${primary.bookmaker}` : ""} has no lay logged - your
            full stake is riding on the result.
            {moreCount > 0 && (
              <span className="text-amber-700/80 dark:text-amber-300/80">
                {" "}
                +{moreCount} more
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href={`/tracker?highlight=${primary.id}`}>Add lay</Link>
          </Button>
          <Button
            variant="pagePrimary"
            size="sm"
            aria-label="Mark as intentionally unhedged"
            className="h-8 text-xs"
            onClick={muteIntentional}
            disabled={muting}
          >
            Intentional
          </Button>
        </div>
      </div>
    </div>
  );
}
