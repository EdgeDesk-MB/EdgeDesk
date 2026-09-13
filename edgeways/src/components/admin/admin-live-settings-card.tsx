"use client";

import { useState } from "react";
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
import { AdminLiveSoundToggle } from "@/components/admin/admin-live-sound-toggle";
import type { AdminLiveSettings } from "@/lib/admin/live-settings-shared";

export function AdminLiveSettingsCard({
  initial,
}: {
  initial: AdminLiveSettings;
}) {
  const [toastsEnabled, setToastsEnabled] = useState(initial.toastsEnabled);
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled);
  const [pollMs, setPollMs] = useState(String(initial.pollMs));
  const [bundleStart, setBundleStart] = useState(String(initial.bundleStart));
  const [bundleHigh, setBundleHigh] = useState(String(initial.bundleHigh));
  const [windowMinutes, setWindowMinutes] = useState(String(initial.windowMinutes));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/live/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toastsEnabled,
          pushEnabled,
          pollMs: Number(pollMs),
          bundleStart: Number(bundleStart),
          bundleHigh: Number(bundleHigh),
          windowMinutes: Number(windowMinutes),
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        settings?: AdminLiveSettings;
      };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save live alerts.");
        return;
      }
      if (body.settings) {
        setToastsEnabled(body.settings.toastsEnabled);
        setPushEnabled(body.settings.pushEnabled);
        setPollMs(String(body.settings.pollMs));
        setBundleStart(String(body.settings.bundleStart));
        setBundleHigh(String(body.settings.bundleHigh));
        setWindowMinutes(String(body.settings.windowMinutes));
      }
      toast.success("Live alerts saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save live alerts."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live alerts</CardTitle>
        <CardDescription className="min-w-0 text-pretty break-words">
          In-app toasts while Admin is open, an optional sound on this browser,
          and owner web push to this account only. Desk activity uses a soft
          chime. Feed warnings and health drops use a harder alert. Volume
          bundles in the window below. Critical feed and health alerts skip
          the wait.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="live-toasts-enabled">In-app toasts</Label>
            <Switch
              id="live-toasts-enabled"
              checked={toastsEnabled}
              onCheckedChange={setToastsEnabled}
            />
          </div>
          <AdminLiveSoundToggle />
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="live-push-enabled">Owner web push</Label>
            <Switch
              id="live-push-enabled"
              checked={pushEnabled}
              onCheckedChange={setPushEnabled}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-poll-ms">Poll interval (ms)</Label>
            <Input
              id="live-poll-ms"
              type="number"
              min={3000}
              step={500}
              inputMode="numeric"
              value={pollMs}
              onChange={(event) => setPollMs(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-window">Bundle window (minutes)</Label>
            <Input
              id="live-window"
              type="number"
              min={5}
              step={5}
              inputMode="numeric"
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-bundle-start">Digest from (events)</Label>
            <Input
              id="live-bundle-start"
              type="number"
              min={2}
              step={1}
              inputMode="numeric"
              value={bundleStart}
              onChange={(event) => setBundleStart(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-bundle-high">Then every (events)</Label>
            <Input
              id="live-bundle-high"
              type="number"
              min={2}
              step={1}
              inputMode="numeric"
              value={bundleHigh}
              onChange={(event) => setBundleHigh(event.target.value)}
            />
          </div>
        </div>
        <div>
          <Button
            type="button"
            {...pagePrimaryButtonProps}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save live alerts"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
