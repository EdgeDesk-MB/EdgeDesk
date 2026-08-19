"use client";

/**
 * Eligible-games picker (H2) - select the promo's eligible games from the
 * RTP library; the highest-RTP pick is highlighted as the one to play and
 * drives the offer's RTP. Values are published base RTPs: verify in the
 * game's own info panel, operators can run lower variants.
 */

import { useState } from "react";
import { Check, ListPlus, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bestGame, formatRtpPct, type CasinoGame } from "@/lib/casino/game-library";
import { cn } from "@/lib/utils";

export function CasinoGamePicker({
  games,
  selectedIds,
  onToggle,
  onRemove,
}: {
  games: CasinoGame[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = games
    .filter((g) => selectedIds.includes(g.id))
    .sort((a, b) => b.rtp - a.rtp);
  const best = bestGame(selected);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Eligible games</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setOpen(true)}
          >
            <ListPlus className="size-3.5" />
            {selected.length > 0 ? "Edit games" : "Pick games"}
          </Button>
          <DialogContent className="max-w-sm p-0" mobile="center">
            <DialogHeader className="mx-0 mt-0">
              <DialogTitle>Eligible games</DialogTitle>
              <DialogDescription>
                Published base RTPs. Verify in the game info.
              </DialogDescription>
            </DialogHeader>
            <Command className="border-t">
              <CommandInput placeholder="Search games…" />
              <CommandList className="max-h-64">
                <CommandEmpty>No matching game in the library.</CommandEmpty>
                <CommandGroup>
                  {games.map((g) => {
                    const active = selectedIds.includes(g.id);
                    return (
                      <CommandItem
                        key={g.id}
                        value={`${g.name} ${g.provider ?? ""}`}
                        onSelect={() => onToggle(g.id)}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                            active && "border-primary bg-primary text-primary-foreground"
                          )}
                        >
                          {active ? <Check className="size-3" aria-hidden /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{g.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatRtpPct(g.rtp)}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((g) => {
            const isBest = best?.id === g.id;
            return (
              <Badge
                key={g.id}
                variant={isBest ? "success" : "outline"}
                className={cn("gap-1 text-xs", !isBest && "text-muted-foreground")}
              >
                {isBest ? <Star className="size-3" aria-hidden /> : null}
                <span className="max-w-[10rem] truncate">{g.name}</span>
                <span className="tabular-nums">{formatRtpPct(g.rtp)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${g.name}`}
                  onClick={() => onRemove(g.id)}
                  className="ml-0.5 rounded-sm hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
      {best ? (
        <p className="text-xs text-success">
          Play {best.name} - highest RTP of your selection. Verify the RTP in the game info
          before you spin.
        </p>
      ) : null}
    </div>
  );
}
