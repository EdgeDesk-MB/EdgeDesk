"use client";

import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PlaceZoneBar } from "@/components/racing/place-zone-bar";
import type { ExchangeProvider } from "@/lib/services/exchange/types";
import { Calculator } from "lucide-react";

export interface RacingDeskSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epStake: number;
  onEpStakeChange: (v: number) => void;
  bookiePlaces: number;
  onBookiePlacesChange: (v: number) => void;
  exchangePlaces: number;
  onExchangePlacesChange: (v: number) => void;
  /** null = use UK race terms per card */
  placeFraction: number | null;
  onPlaceFractionChange: (v: number | null) => void;
  deskExchange: ExchangeProvider | "default";
  onDeskExchangeChange: (v: string) => void;
  defaultExchangeName?: string;
  exchanges: Array<{ id: number; name: string; isDefault?: boolean }>;
  exchangeNameToProvider: (name: string) => ExchangeProvider | null;
  showOfferGuide: boolean;
  onShowOfferGuideChange: (v: boolean) => void;
}

export function RacingDeskSettingsDialog({
  open,
  onOpenChange,
  epStake,
  onEpStakeChange,
  bookiePlaces,
  onBookiePlacesChange,
  exchangePlaces,
  onExchangePlacesChange,
  placeFraction,
  onPlaceFractionChange,
  deskExchange,
  onDeskExchangeChange,
  defaultExchangeName,
  exchanges,
  exchangeNameToProvider,
  showOfferGuide,
  onShowOfferGuideChange,
}: RacingDeskSettingsDialogProps) {
  const epValid = bookiePlaces > exchangePlaces;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b bg-selection-subtle px-5 py-4 pr-14">
          <DialogTitle>Racing Desk settings</DialogTitle>
          <DialogDescription>
            Defaults for bets from the racecard. Advanced view stays on the table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pt-4 pb-7">
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Betting defaults
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Used when opening win, lay, place-refund, or EP bets from a runner.
              </p>
            </div>
            <div className="flex w-28 flex-col gap-1">
              <Label htmlFor="desk-default-stake" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Stake (£)
              </Label>
              <Input
                id="desk-default-stake"
                type="number"
                min={1}
                value={epStake}
                onChange={(e) => onEpStakeChange(parseFloat(e.target.value) || 10)}
                className="h-8"
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extra place
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Bookie vs exchange place terms for EP actions on the racecard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor="desk-bookie-places" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Bookie places
                </Label>
                <Input
                  id="desk-bookie-places"
                  type="number"
                  min={2}
                  max={8}
                  value={bookiePlaces}
                  onChange={(e) => onBookiePlacesChange(parseInt(e.target.value, 10) || 4)}
                  className="h-8"
                />
              </div>
              <div className="flex w-24 flex-col gap-1">
                <Label htmlFor="desk-exch-places" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Exch. places
                </Label>
                <Input
                  id="desk-exch-places"
                  type="number"
                  min={2}
                  max={8}
                  value={exchangePlaces}
                  onChange={(e) => onExchangePlacesChange(parseInt(e.target.value, 10) || 3)}
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex max-w-xs flex-col gap-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Place terms default
              </Label>
              <Select
                value={placeFraction == null ? "auto" : String(placeFraction)}
                onValueChange={(v) =>
                  onPlaceFractionChange(v === "auto" ? null : parseFloat(v))
                }
              >
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto from race (UK terms)</SelectItem>
                  <SelectItem value="0.25">Force 1/4 odds</SelectItem>
                  <SelectItem value="0.2">Force 1/5 odds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {epValid && (
              <PlaceZoneBar
                exchangePlaces={exchangePlaces}
                bookiePlaces={bookiePlaces}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {epValid ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  EP zone: {exchangePlaces + 1}–{bookiePlaces}
                </span>
              ) : (
                <span className="text-muted-foreground">Bookie places must exceed exchange</span>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                <Link href="/calculators/each-way">
                  <Calculator className="size-3.5" />
                  Open EP calculator
                </Link>
              </Button>
            </div>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Exchange
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Which exchange feeds lay prices on this desk. Default follows app Settings.
              </p>
            </div>
            <div className="flex max-w-xs flex-col gap-1">
              <Label htmlFor="desk-settings-exchange" className="sr-only">
                Desk exchange
              </Label>
              <Select value={deskExchange} onValueChange={onDeskExchangeChange}>
                <SelectTrigger id="desk-settings-exchange" size="sm" className="h-8">
                  <SelectValue placeholder="Exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Default
                    {defaultExchangeName ? ` (${defaultExchangeName})` : ""}
                  </SelectItem>
                  {exchanges.map((ex) => {
                    const provider = exchangeNameToProvider(ex.name);
                    if (!provider) return null;
                    return (
                      <SelectItem key={ex.id} value={provider}>
                        {ex.name}
                        {ex.isDefault ? " · app default" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Display
              </h3>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="desk-show-offer-guide" className="text-sm font-medium">
                  Offer workflow
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show the place-refund checklist on qualifying races.
                </p>
              </div>
              <Switch
                id="desk-show-offer-guide"
                size="sm"
                checked={showOfferGuide}
                onCheckedChange={onShowOfferGuideChange}
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
