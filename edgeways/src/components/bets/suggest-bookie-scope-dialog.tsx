"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clampEpLeadBy,
  defaultEpLeadBy,
  epLeadUnit,
  formatEpRule,
  type EpDeskSport,
} from "@/lib/twoup/bookie-offers";
import { sportDisplayLabel } from "@/lib/sports";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";
import { Bookmark } from "lucide-react";

export function SuggestBookieScopeDialog({
  open,
  bookie,
  sport,
  leadBy,
  reason,
  onConfirm,
  onDecline,
}: {
  open: boolean;
  bookie: string;
  sport: EpDeskSport;
  leadBy: number;
  reason?: string;
  onConfirm: (leadBy: number) => void;
  onDecline: () => void;
}) {
  const [lead, setLead] = useState(leadBy);

  useEffect(() => {
    if (open) setLead(clampEpLeadBy(leadBy || defaultEpLeadBy(sport)));
  }, [leadBy, open, sport]);

  const unit = epLeadUnit(sport);
  const n = clampEpLeadBy(lead);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline();
      }}
    >
      <DialogContent className="max-w-sm" mobile="center">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <Bookmark className={dialogTitleIcon} />
            Write this to Scope?
          </DialogTitle>
          <DialogDescription>
            {bookie} · {sportDisplayLabel(sport)}. Decline still saves.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-1">
          {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Lead that pays</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                inputMode="numeric"
                value={n}
                onChange={(event) => setLead(Number(event.target.value))}
                className="w-20"
                aria-label="Lead that pays"
              />
              <span className="text-sm text-muted-foreground">
                {n === 1 ? unit.singular : unit.plural} ahead
                {sport === "football" ? ` · ${formatEpRule(sport, n)}` : ""}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDecline}>
            Not now
          </Button>
          <Button type="button" onClick={() => onConfirm(n)}>
            Write to Scope
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
