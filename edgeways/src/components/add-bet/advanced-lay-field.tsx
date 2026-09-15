"use client";

import type { ReactNode } from "react";
import { AddBetStripFlagToggle } from "@/components/add-bet/strip-flag-toggle";
import { AddBetStripHeader } from "@/components/add-bet/strip-header";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import { CollapseReveal } from "@/components/ui/collapse-reveal";
import type { LayBounds, PartLay } from "@/lib/calc";
import { SlidersHorizontal } from "lucide-react";

export function AddBetAdvancedLayField({
  leading,
  enabled,
  onEnabledChange,
  bounds,
  layStake,
  onLayStake,
  lockedSnap,
  onLockedSnap,
  partLays,
  onPartLays,
  accent,
}: {
  leading?: ReactNode;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  bounds: LayBounds | null;
  layStake: number;
  onLayStake: (v: number) => void;
  lockedSnap: keyof LayBounds | null;
  onLockedSnap: (snap: keyof LayBounds | null) => void;
  partLays: PartLay[];
  onPartLays: (v: PartLay[]) => void;
  accent: string;
}) {
  return (
    <div>
      <AddBetStripHeader
        leading={leading}
        trailing={
          <AddBetStripFlagToggle
            icon={
              <SlidersHorizontal
                className="size-3 shrink-0 text-black/55 dark:text-white/70"
                aria-hidden
              />
            }
            label="Advanced"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        }
      />

      <CollapseReveal open={enabled}>
        <div className="pt-4">
          {bounds ? (
            <AdvancedLaySection
              bounds={bounds}
              layStake={layStake}
              onLayStake={onLayStake}
              lockedSnap={lockedSnap}
              onLockedSnap={onLockedSnap}
              partLays={partLays}
              onPartLays={onPartLays}
              accent={accent}
            />
          ) : (
            <p className="text-xs leading-snug text-black/55 dark:text-white/65">
              Complete back and lay details to unlock part lays and the
              underlay/overlay slider.
            </p>
          )}
        </div>
      </CollapseReveal>
    </div>
  );
}
