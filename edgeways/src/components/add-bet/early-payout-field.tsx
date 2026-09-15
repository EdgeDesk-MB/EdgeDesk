"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddBetStripFlagToggle } from "@/components/add-bet/strip-flag-toggle";
import { AddBetStripHeader } from "@/components/add-bet/strip-header";
import { CollapseReveal } from "@/components/ui/collapse-reveal";
import {
  clampEpLeadBy,
  earlyPayoutPaidWhenCopy,
  epLeadUnit,
  formatEpRule,
  type EpDeskSport,
} from "@/lib/twoup/bookie-offers";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";

const onStripField =
  "border-0 bg-[var(--pi)] text-black/85 " +
  "hover:bg-[var(--pi)] " +
  "dark:bg-[color-mix(in_srgb,var(--pi-dark)_72%,black)] " +
  "dark:text-white/95 " +
  "dark:hover:bg-[color-mix(in_srgb,var(--pi-dark)_66%,black)]";

export function AddBetEarlyPayoutField({
  leading,
  toggleVisible = true,
  enabled,
  onEnabledChange,
  sport,
  leadBy,
  onLeadByChange,
}: {
  leading?: ReactNode;
  toggleVisible?: boolean;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  sport: EpDeskSport;
  leadBy: number;
  onLeadByChange: (leadBy: number) => void;
}) {
  const lead = clampEpLeadBy(leadBy);
  const footballLead = lead === 1 ? 1 : 2;
  const unit = epLeadUnit(sport);
  const unitLabel = lead === 1 ? unit.singular : unit.plural;

  return (
    <div>
      <AddBetStripHeader
        leading={leading}
        trailing={
          toggleVisible ? (
            <AddBetStripFlagToggle
              icon={
                <Timer
                  className="size-3 shrink-0 text-black/55 dark:text-white/70"
                  aria-hidden
                />
              }
              label="Early payout"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          ) : undefined
        }
      />

      {toggleVisible ? (
        <CollapseReveal open={enabled}>
        {sport === "football" ? (
          <div className="flex flex-col gap-1.5 pt-4">
            <Select
              value={String(footballLead)}
              onValueChange={(value) => onLeadByChange(Number(value))}
            >
              <SelectTrigger
                aria-label="Football early payout"
                className={cn("w-full", onStripField)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">{formatEpRule("football", 2)}</SelectItem>
                <SelectItem value="1">{formatEpRule("football", 1)}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-snug text-black/55 dark:text-white/65">
              {earlyPayoutPaidWhenCopy("football", footballLead)}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2 pt-4">
            <Label htmlFor="add-bet-ep-lead" className="sr-only">
              Lead that pays
            </Label>
            <Input
              id="add-bet-ep-lead"
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              aria-label="Lead that pays"
              value={lead}
              onChange={(event) => onLeadByChange(Number(event.target.value))}
              className={cn("w-[4.5rem] tabular-nums", onStripField)}
            />
            <span className="text-xs text-black/55 dark:text-white/65">
              {unitLabel} ahead
            </span>
          </div>
        )}
        </CollapseReveal>
      ) : null}
    </div>
  );
}
