"use client";

/**
 * G2 demo mode - a separate, watermarked database for screenshots and
 * walkthroughs. Switching requires a server restart on purpose: the demo and
 * real databases are different FILES chosen at connection time, which is
 * what makes contamination impossible.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api } from "@/hooks/use-app-state";

type DemoStatus = { active: boolean; markerPresent: boolean };

export function DemoModeCard() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<DemoStatus>("/api/data/demo")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      const next = await api<DemoStatus>("/api/data/demo", {
        method: "POST",
        json: { enabled },
      });
      setStatus(next);
      toast.success(enabled ? "Demo mode armed" : "Demo mode disarmed", {
        description: "Restart the server (npm run dev) to apply.",
      });
    } catch (e) {
      toast.error("Could not update demo mode", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function wipeDemo() {
    setBusy(true);
    try {
      await api("/api/data/demo", { method: "POST", json: { enabled: false, wipe: true } });
      const next = await api<DemoStatus>("/api/data/demo");
      setStatus(next);
      toast.success("Demo data wiped", {
        description: "The next demo run starts from a fresh seeded dataset.",
      });
    } catch (e) {
      toast.error("Could not wipe demo data", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (status == null) return null;
  const restartNeeded = status.active !== status.markerPresent;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorPlay className="size-4" /> Demo mode
        </CardTitle>
        <CardDescription>
          A separate, seeded database for screenshots and walkthroughs - clearly watermarked,
          and your real data never mixes with it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Use demo data</p>
            <p className="text-xs text-muted-foreground">
              {status.active
                ? "Demo database active - every page shows invented numbers."
                : "Real database active."}
              {restartNeeded ? " Restart the server to apply the change." : ""}
            </p>
          </div>
          <Switch
            checked={status.markerPresent}
            disabled={busy}
            aria-label="Use demo data after the next server restart"
            onCheckedChange={(v) => void toggle(v)}
          />
        </div>
        {!status.active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => void wipeDemo()}
          >
            Wipe demo data
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
