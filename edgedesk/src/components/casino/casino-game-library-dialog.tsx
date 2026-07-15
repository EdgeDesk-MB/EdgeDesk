"use client";

/**
 * Game RTP library manager (H2) - view, add, correct and remove reference
 * games. Seeded values are published base RTPs; your operator may run a
 * lower variant, so corrections here are expected, not exceptional.
 */

import { useCallback, useEffect, useState } from "react";
import { Library, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { NumField } from "@/components/calc/num-field";
import { api } from "@/hooks/use-app-state";
import { formatRtpPct, type CasinoGame } from "@/lib/casino/game-library";

export function CasinoGameLibraryDialog() {
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<CasinoGame[] | null>(null);
  const [name, setName] = useState("");
  const [rtpPct, setRtpPct] = useState(96);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ games: CasinoGame[] }>("/api/casino/games")
      .then((r) => setGames(r.games))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function save() {
    if (!name.trim() || !(rtpPct >= 50 && rtpPct <= 100)) return;
    setSaving(true);
    try {
      await api("/api/casino/games", {
        method: "POST",
        json: { name: name.trim(), rtp: rtpPct / 100 },
      });
      setName("");
      load();
    } catch {
      // Leave the form as-is for correction.
    } finally {
      setSaving(false);
    }
  }

  async function remove(game: CasinoGame) {
    await api(`/api/casino/games/${game.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Library className="size-3.5" /> Game library
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(34rem,85vh)] max-w-md flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Game RTP library</DialogTitle>
          <DialogDescription>
            Published base RTPs - operators can license lower variants of the same game, so
            correct any value to what the in-game info shows. Re-adding a name updates it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid shrink-0 grid-cols-[1fr_7rem_auto] items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="game-name" className="text-xs text-muted-foreground">
              Game
            </Label>
            <Input
              id="game-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blood Suckers"
            />
          </div>
          <NumField label="RTP (%)" value={rtpPct} onChange={setRtpPct} min={50} step={0.01} />
          <Button
            onClick={() => void save()}
            disabled={saving || !name.trim() || !(rtpPct >= 50 && rtpPct <= 100)}
          >
            Save
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {games == null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : games.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Library is empty - add the games your casinos list.
            </p>
          ) : (
            <ul className="divide-y">
              {[...games]
                .sort((a, b) => b.rtp - a.rtp)
                .map((g) => (
                  <li key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    {g.provider ? (
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {g.provider}
                      </span>
                    ) : null}
                    <span className="shrink-0 tabular-nums">{formatRtpPct(g.rtp)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={`Delete ${g.name}`}
                      onClick={() => void remove(g)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
