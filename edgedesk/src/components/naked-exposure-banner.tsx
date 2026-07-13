"use client";

/**
 * Naked-exposure banner (B5) - prominent Home warning for open backs with no
 * lay past the threshold. One tap marks a bet as intentionally unhedged
 * (mute marker in notes); "Add lay" deep-links to the tracker row.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  detectNakedExposure,
  markIntentionalNoHedge,
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
    return detectNakedExposure(state.bets, eventStarts, now);
  }, [state, now]);

  if (exposed.length === 0) return null;

  const primary = exposed[0]!;
  const moreCount = exposed.length - 1;

  async function muteIntentional() {
    setMuting(true);
    try {
      await api(`/api/bets/${primary.id}`, {
        method: "PATCH",
        json: { notes: markIntentionalNoHedge(primary.notes) },
      });
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
    <div
      className={cn(
        "flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-[var(--layout-page-x)] py-2.5 text-sm",
        className
      )}
      role="status"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
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
            <span className="text-amber-700/80 dark:text-amber-300/80"> +{moreCount} more</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
          <Link href={`/tracker?highlight=${primary.id}`}>Add lay</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Mark as intentionally unhedged"
          className="h-8 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300"
          onClick={muteIntentional}
          disabled={muting}
        >
          Intentional
        </Button>
      </div>
    </div>
  );
}
