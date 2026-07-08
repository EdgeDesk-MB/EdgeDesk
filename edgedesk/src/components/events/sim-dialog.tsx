"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { simPresets } from "@/components/events/types";
import { FlaskConical } from "lucide-react";

export function SimDialog({
  onStart,
}: {
  onStart: (preset: string, stars: { homeStar?: string; awayStar?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState("two_up_drama");
  const [homeStar, setHomeStar] = useState("");
  const [awayStar, setAwayStar] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" {...pageSecondaryButtonProps}>
          <FlaskConical className="size-4" /> Simulate match
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Start a simulated match</DialogTitle>
          <DialogDescription>
            A full 90 minutes plays out in about 3 real minutes — perfect for testing bets and the
            live dashboard without waiting for a real kick-off.
          </DialogDescription>
        </DialogHeader>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {simPresets.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Home star striker</Label>
            <Input
              placeholder="optional"
              value={homeStar}
              onChange={(e) => setHomeStar(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Away star striker</Label>
            <Input
              placeholder='e.g. "Harry Kane"'
              value={awayStar}
              onChange={(e) => setAwayStar(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Name a striker and they&apos;ll score their side&apos;s first goal — ideal for testing a
          &quot;wins IF&quot; goalscorer trigger.
        </p>
        <Button
          onClick={() => {
            onStart(preset, {
              homeStar: homeStar.trim() || undefined,
              awayStar: awayStar.trim() || undefined,
            });
            setOpen(false);
          }}
        >
          Kick off
        </Button>
      </DialogContent>
    </Dialog>
  );
}
