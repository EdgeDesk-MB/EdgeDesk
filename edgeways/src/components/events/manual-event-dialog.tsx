"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { api } from "@/hooks/use-app-state";
import { toastAddedToTrackedEvents } from "@/components/events/track-toast";
import { SportLabel } from "@/components/sport-icon";
import { SPORTS } from "@/lib/markets";
import { isRacingSport } from "@/lib/sports";

export function ManualEventDialog({
  onSaved,
  open,
  onOpenChange,
  trigger,
}: {
  onSaved: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (!isControlled) setInternalOpen(next);
  };
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [competition, setCompetition] = useState("");
  const [sport, setSport] = useState("football");

  async function save() {
    if (!homeTeam || !awayTeam) {
      toast.error("Enter both team/selection names");
      return;
    }
    try {
      await api("/api/events", {
        method: "POST",
        json: { homeTeam, awayTeam, competition: competition || undefined, sport, source: "manual" },
      });
      const label =
        isRacingSport(sport)
          ? `${competition || "Race"} · ${homeTeam}`
          : `${homeTeam} v ${awayTeam}`;
      toastAddedToTrackedEvents(label, () => router.push("/tracked-events"));
      setDialogOpen(false);
      setHomeTeam("");
      setAwayTeam("");
      onSaved();
    } catch (e) {
      toast.error("Could not add event", { description: String(e) });
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ?? (
        <DialogTrigger asChild>
          <Button {...pageSecondaryButtonProps}>Add manually</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add event</DialogTitle>
          <DialogDescription>
            For racing, TV markets, or anything the feeds miss.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sport</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <SportLabel sport={s.value} size={14} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Home team / selection</Label>
            <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Away team / field</Label>
            <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Competition (optional)</Label>
            <Input value={competition} onChange={(e) => setCompetition(e.target.value)} />
          </div>
          <Button onClick={save}>Add to Tracked Events</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
