"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeedCaps } from "@/lib/admin/feed-caps";

/**
 * Raise the daily ceilings when the provider plan is upgraded. Football's cap
 * is enforced on every API-Football request; racing's only drives the monitor
 * thresholds (the provider's real limit is per-second).
 */
export function FeedCapsForm({ initial }: { initial: FeedCaps }) {
  const router = useRouter();
  const [football, setFootball] = useState(String(initial.football));
  const [racing, setRacing] = useState(String(initial.racing));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/feeds/caps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ football: Number(football), racing: Number(racing) }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save caps.");
        return;
      }
      toast.success("Feed caps updated. New requests use the new ceiling immediately.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save caps.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily caps</CardTitle>
        <CardDescription>
          Raise these when you upgrade a provider plan. Football is a hard
          ceiling; racing is the alert threshold.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap-football">Football requests/day</Label>
            <Input
              id="cap-football"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={football}
              onChange={(event) => setFootball(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cap-racing">Racing alert threshold/day</Label>
            <Input
              id="cap-racing"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={racing}
              onChange={(event) => setRacing(event.target.value)}
            />
          </div>
        </div>
        <div>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save caps"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
