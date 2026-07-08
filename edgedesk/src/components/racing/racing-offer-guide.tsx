"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RacingDeskRace } from "@/lib/racing-desk/types";
import {
  Calculator,
  Check,
  ChevronDown,
  Gift,
  ListChecks,
  NotebookPen,
  Pin,
} from "lucide-react";

export interface RacingOfferGuideProps {
  race: RacingDeskRace;
  onBack: (runnerName: string) => void;
  onLay: (runnerName: string) => void;
  onTrack: () => void;
}

type StepId = "pick" | "back" | "lay" | "log";

function StepRow({
  done,
  active,
  label,
  detail,
  action,
}: {
  done: boolean;
  active: boolean;
  label: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        active && "bg-selection-subtle",
        done && "opacity-80"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          done
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : active
              ? "border-foreground/30 bg-card text-foreground"
              : "border-border text-muted-foreground"
        )}
      >
        {done ? <Check className="size-2.5" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "line-through decoration-muted-foreground/50")}>
          {label}
        </p>
        {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

export function RacingOfferGuide({ race, onBack, onLay, onTrack }: RacingOfferGuideProps) {
  const [expanded, setExpanded] = useState(true);
  const [backDone, setBackDone] = useState(false);
  const [layDone, setLayDone] = useState(false);

  const offerTag = race.offerTags
    .filter((t) => t.qualifies)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  if (!offerTag) return null;

  const targetRunner =
    offerTag.suggestedRunners?.[0]?.name ??
    race.runners.find((r) => (r.offerTargetScore ?? 0) >= 35)?.name ??
    race.runners.find((r) => !r.nonRunner)?.name;

  const tracked = race.trackedEventId != null;
  const logged = tracked || race.openBetCount > 0;

  const steps: Array<{ id: StepId; done: boolean; active: boolean }> = [
    { id: "pick", done: true, active: false },
    { id: "back", done: backDone || race.openBetCount > 0, active: !backDone && race.openBetCount === 0 },
    { id: "lay", done: layDone, active: backDone && !layDone },
    { id: "log", done: logged, active: (backDone || race.openBetCount > 0) && !logged },
  ];

  const nextStep = steps.find((s) => !s.done)?.id ?? "log";

  return (
    <div className="mt-2 rounded-md border border-emerald-500/25 bg-emerald-500/5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <ListChecks className="size-3.5" />
          Offer workflow
          <span className="font-normal normal-case text-muted-foreground">
            · {offerTag.offerTitle}
          </span>
        </span>
        <ChevronDown
          className={cn("size-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <ol className="space-y-0.5 border-t border-emerald-500/15 px-1 pb-2 pt-1">
          <StepRow
            done
            active={nextStep === "pick"}
            label="Pick race"
            detail={`${race.course} ${race.offTime} — qualifying for ${offerTag.bookmaker ?? "your offer"}`}
          />

          <StepRow
            done={steps[1].done}
            active={nextStep === "back"}
            label="Back (qualifying bet)"
            detail={
              targetRunner
                ? `Back ${targetRunner} @ £${offerTag.betStake ?? "—"} stake`
                : "Choose a runner from the card"
            }
            action={
              targetRunner && !steps[1].done ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => {
                    onBack(targetRunner);
                    setBackDone(true);
                  }}
                >
                  <Gift className="size-3" />
                  Back
                </Button>
              ) : null
            }
          />

          <StepRow
            done={steps[2].done}
            active={nextStep === "lay"}
            label="Lay (matched calc)"
            detail="Open matched calculator with prefilled odds"
            action={
              targetRunner && !steps[2].done ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => {
                    onLay(targetRunner);
                    setLayDone(true);
                  }}
                >
                  <Calculator className="size-3" />
                  Lay
                </Button>
              ) : null
            }
          />

          <StepRow
            done={steps[3].done}
            active={nextStep === "log"}
            label="Log in tracker"
            detail={tracked ? "Race tracked — bets linked" : "Track race so results settle your bets"}
            action={
              !tracked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={onTrack}
                >
                  <Pin className="size-3" />
                  Track
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-[11px]"
                  asChild
                >
                  <Link href="/tracker">
                    <NotebookPen className="size-3" />
                    Tracker
                  </Link>
                </Button>
              )
            }
          />
        </ol>
      )}
    </div>
  );
}
