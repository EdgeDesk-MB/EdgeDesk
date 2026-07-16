"use client";

/**
 * Global "Log a casino offer" dialog (H2) - openable from the side-nav quick
 * action on any page, mirroring the add-bet / matched-calculator providers.
 * Saving fires CASINO_CHANGED_EVENT so the Casino page refreshes if mounted.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumField } from "@/components/calc/num-field";
import { CasinoGamePicker } from "@/components/casino/casino-game-picker";
import { CasinoPasteDialog } from "@/components/casino/casino-paste-dialog";
import { CasinoSimDialog } from "@/components/casino/casino-sim-dialog";
import { BASIS_COPY, CASINO_CHANGED_EVENT, VarianceChip, gbp } from "@/components/casino/casino-ui";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api } from "@/hooks/use-app-state";
import {
  casinoOfferEv,
  houseEdgeFromRtp,
  varianceTier,
  varianceTierCopy,
  DEFAULT_RTP,
} from "@/lib/calc/casino-ev";
import { bestGame, matchGamesInText, type CasinoGame } from "@/lib/casino/game-library";

type CasinoLogContextValue = {
  openCasinoLog: () => void;
};

const CasinoLogContext = createContext<CasinoLogContextValue | null>(null);

export function useCasinoLog() {
  const ctx = useContext(CasinoLogContext);
  if (!ctx) throw new Error("useCasinoLog must be used within CasinoLogProvider");
  return ctx;
}

export function CasinoLogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [casino, setCasino] = useState("");
  const [title, setTitle] = useState("");
  const [bonus, setBonus] = useState(20);
  const [wagering, setWagering] = useState(35);
  const [rtpPct, setRtpPct] = useState(NaN); // percent; empty = 96% default
  const [contributionPct, setContributionPct] = useState(100);
  const [saving, setSaving] = useState(false);
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);

  const openCasinoLog = useCallback(() => setOpen(true), []);

  // The library is small and user-editable - refresh it each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    api<{ games: CasinoGame[] }>("/api/casino/games")
      .then((r) => setGames(r.games))
      .catch(() => {});
  }, [open]);

  function resetForm() {
    setCasino("");
    setTitle("");
    setBonus(20);
    setWagering(35);
    setRtpPct(NaN);
    setContributionPct(100);
    setSelectedGameIds([]);
  }

  const selectedGames = games.filter((g) => selectedGameIds.includes(g.id));
  const recommendedGame = bestGame(selectedGames);

  /** Selection drives the RTP field (still editable afterwards). */
  function applySelection(ids: number[]) {
    setSelectedGameIds(ids);
    const best = bestGame(games.filter((g) => ids.includes(g.id)));
    if (best) setRtpPct(best.rtp * 100);
  }

  const rtpEntered = Number.isFinite(rtpPct);
  const verdict = useMemo(() => {
    const rtp = rtpEntered ? rtpPct / 100 : DEFAULT_RTP;
    const contribution = Number.isFinite(contributionPct)
      ? Math.min(1, Math.max(0.01, contributionPct / 100))
      : 1;
    return {
      ...casinoOfferEv({
        bonusAmount: bonus,
        wageringMultiplier: wagering,
        houseEdge: houseEdgeFromRtp(rtp),
        contributionPct: contribution,
      }),
      tier: varianceTier({
        wageringMultiplier: wagering,
        houseEdge: houseEdgeFromRtp(rtp),
        contributionPct: contribution,
      }),
    };
  }, [bonus, wagering, rtpPct, rtpEntered, contributionPct]);

  async function save() {
    if (!title.trim() || !(bonus > 0)) return;
    setSaving(true);
    try {
      await api("/api/casino", {
        method: "POST",
        json: {
          casino: casino.trim() || undefined,
          title: title.trim(),
          bonusAmount: bonus,
          wageringMultiplier: Number.isFinite(wagering) ? wagering : 0,
          rtp: rtpEntered ? rtpPct / 100 : null,
          contributionPct: Number.isFinite(contributionPct)
            ? Math.min(1, Math.max(0.01, contributionPct / 100))
            : null,
          status: "active",
          game: recommendedGame?.name ?? null,
        },
      });
      setOpen(false);
      resetForm();
      window.dispatchEvent(new Event(CASINO_CHANGED_EVENT));
    } catch {
      // Validation rejections leave the dialog open for correction.
    } finally {
      setSaving(false);
    }
  }

  return (
    <CasinoLogContext.Provider value={{ openCasinoLog }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log a casino offer</DialogTitle>
            <DialogDescription>
              EV is an expectation across many attempts, never a lock - the variance tier says how
              far one session can stray.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-start">
            <CasinoPasteDialog
              onApply={(draft) => {
                if (draft.casino) setCasino(draft.casino);
                if (draft.title) setTitle(draft.title);
                if (draft.bonusAmount != null) setBonus(draft.bonusAmount);
                if (draft.wageringMultiplier != null) setWagering(draft.wageringMultiplier);
                if (draft.rtp != null) setRtpPct(draft.rtp * 100);
                if (draft.contributionPct != null) setContributionPct(draft.contributionPct * 100);
                // Recognise the promo's eligible-games list against the library;
                // the best pick's library RTP then beats any generic parsed RTP.
                const matched = matchGamesInText(draft.sourceText, games);
                if (matched.length > 0) applySelection(matched.map((g) => g.id));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="casino-name" className="text-xs text-muted-foreground">
                Casino
              </Label>
              <Input
                id="casino-name"
                value={casino}
                onChange={(e) => setCasino(e.target.value)}
                placeholder="e.g. Sky Vegas"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="casino-title" className="text-xs text-muted-foreground">
                Offer
              </Label>
              <Input
                id="casino-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stake £10 get 50 spins"
              />
            </div>
            <NumField label="Bonus value" prefix="£" value={bonus} onChange={setBonus} min={0} />
            <NumField label="Wagering (×)" value={wagering} onChange={setWagering} min={0} step={1} />
            <NumField
              label="Game RTP (%)"
              value={rtpPct}
              onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={50}
              step={0.1}
              placeholder="96 default"
              hint={rtpEntered ? undefined : "Using the 96% slot default"}
            />
            <NumField
              label="Contribution (%)"
              value={contributionPct}
              onChange={setContributionPct}
              min={1}
              step={5}
            />
          </div>
          <CasinoGamePicker
            games={games}
            selectedIds={selectedGameIds}
            onToggle={(id) =>
              applySelection(
                selectedGameIds.includes(id)
                  ? selectedGameIds.filter((x) => x !== id)
                  : [...selectedGameIds, id]
              )
            }
            onRemove={(id) => applySelection(selectedGameIds.filter((x) => x !== id))}
          />
          <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Verdict
              </span>
              <span className="flex items-center gap-2">
                <EvBasisBadge
                  basis={rtpEntered ? "estimated" : "heuristic"}
                  description={rtpEntered ? BASIS_COPY.entered : BASIS_COPY.defaulted}
                />
                <VarianceChip tier={verdict.tier} />
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              EV {gbp(verdict.ev)}{" "}
              <span className="font-normal text-muted-foreground">
                · £{verdict.totalTurnover.toFixed(2)} turnover · £{verdict.wageringDrag.toFixed(2)}{" "}
                expected drag
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{varianceTierCopy(verdict.tier)}</p>
          </div>
          <div className="flex justify-end gap-2">
            {bonus > 0 ? (
              <CasinoSimDialog
                triggerClassName="mr-auto"
                offer={{
                  title: title.trim() || "this offer",
                  bonusAmount: bonus,
                  wageringMultiplier: Number.isFinite(wagering) ? wagering : 0,
                  rtp: rtpEntered ? rtpPct / 100 : null,
                  contributionPct: Number.isFinite(contributionPct)
                    ? Math.min(1, Math.max(0.01, contributionPct / 100))
                    : null,
                  defaultVolatility: verdict.tier,
                }}
              />
            ) : null}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !title.trim() || !(bonus > 0)}>
              Start offer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CasinoLogContext.Provider>
  );
}
