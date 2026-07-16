"use client";

/**
 * J1 edit-after: shows the latest measured execution time for a campaign
 * with an inline correction (hybrid capture - automatic, user-adjustable).
 */

import { useEffect, useState } from "react";
import { Check, Pencil, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/hooks/use-app-state";
import type { OfferEffortSampleRow } from "@/lib/db/schema";

export function OfferEffortLine({ offerId }: { offerId: number }) {
  const [sample, setSample] = useState<OfferEffortSampleRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    let live = true;
    api<{ samples: OfferEffortSampleRow[] }>(`/api/effort?offerId=${offerId}`)
      .then((r) => {
        if (live) setSample(r.samples[0] ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [offerId]);

  if (!sample) return null;

  async function save() {
    const n = parseFloat(minutes);
    if (!Number.isFinite(n) || n <= 0) {
      setEditing(false);
      return;
    }
    const r = await api<{ sample: OfferEffortSampleRow }>("/api/effort", {
      method: "PATCH",
      json: { id: sample!.id, durationMin: n },
    }).catch(() => null);
    if (r) setSample(r.sample);
    setEditing(false);
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Timer className="size-3.5" aria-hidden />
      {editing ? (
        <>
          <Input
            type="number"
            inputMode="decimal"
            min={0.5}
            step={0.5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-6 w-16 px-1.5 text-xs"
            aria-label="Execution time in minutes"
            autoFocus
          />
          <span>min</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Save execution time"
            onClick={() => void save()}
          >
            <Check className="size-3" />
          </Button>
        </>
      ) : (
        <>
          <span>
            Logged in {sample.durationMin.toFixed(1).replace(/\.0$/, "")} min
            {sample.edited ? " (edited)" : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            aria-label="Correct the execution time"
            onClick={() => {
              setMinutes(String(sample.durationMin));
              setEditing(true);
            }}
          >
            <Pencil className="size-3" />
          </Button>
        </>
      )}
    </span>
  );
}
