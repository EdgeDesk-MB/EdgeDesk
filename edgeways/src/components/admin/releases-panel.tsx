"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/help/empty-state";
import { MaintenanceBannerView } from "@/components/admin/maintenance-banner";
import type { FlagsOverview } from "@/lib/admin/flags";
import type { MaintenanceBanner } from "@/lib/admin/operator-settings";

export function ReleasesPanel({
  flags,
  banner,
}: {
  flags: FlagsOverview;
  banner: MaintenanceBanner;
}) {
  const [enabled, setEnabled] = useState(banner.enabled);
  const [message, setMessage] = useState(banner.message);
  const [saving, setSaving] = useState(false);
  const [flagBusy, setFlagBusy] = useState<number | null>(null);
  const [flagRows, setFlagRows] = useState(flags.flags);

  async function saveBanner() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banner: { enabled, message } }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save the banner.");
        return;
      }
      toast.success(enabled ? "Maintenance banner is on." : "Maintenance banner is off.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the banner.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(id: number, active: boolean) {
    setFlagBusy(id);
    try {
      const res = await fetch("/api/admin/releases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: { id, active } }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not update the flag.");
        return;
      }
      setFlagRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, active } : row))
      );
      toast.success(body.message ?? "Flag updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the flag.");
    } finally {
      setFlagBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance banner</CardTitle>
          <CardDescription>
            Shows on the desk for every signed-in account. Keep it short.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="maintenance-enabled">Show banner</Label>
            <Switch
              id="maintenance-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maintenance-message">Message</Label>
            <Input
              id="maintenance-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={180}
            />
          </div>
          <Button type="button" {...pagePrimaryButtonProps} disabled={saving} onClick={() => void saveBanner()}>
            {saving ? "Saving…" : "Save banner"}
          </Button>
          {enabled ? (
            <MaintenanceBannerView
              message={message.trim() || "Banner is on. Add a message."}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Preview appears here when the banner is on.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release flags</CardTitle>
          <CardDescription>
            PostHog flags for staged rollouts. Deploys stay on Vercel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {flags.message ? (
            <p className="text-sm text-muted-foreground">{flags.message}</p>
          ) : null}
          {flagRows.length === 0 ? (
            <EmptyState
              compact
              icon={Flag}
              title="No flags loaded"
              description="Connect PostHog, or open the project to add a flag."
            />
          ) : (
            flagRows.map((flag) => (
              <div key={flag.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{flag.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {flag.key}
                    {flag.rollout != null ? (
                      <span className="ml-1.5 font-semibold text-warning">
                        {flag.rollout}% rollout
                      </span>
                    ) : null}
                  </p>
                </div>
                <Switch
                  checked={flag.active}
                  disabled={flagBusy === flag.id}
                  onCheckedChange={(active) => void toggleFlag(flag.id, active)}
                />
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={flags.projectUrl} target="_blank" rel="noreferrer">
                Open PostHog
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={flags.vercelUrl} target="_blank" rel="noreferrer">
                Open Vercel
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={flags.currentDeployUrl} target="_blank" rel="noreferrer">
                Open this deploy
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
