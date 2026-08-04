"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import {
  Calculator,
  Gift,
  Key,
  LayoutDashboard,
  Sparkles,
  Trophy,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Edgeways",
    body: "A local-first matched betting command centre. Calculators, live events, offer tracking and a real-time P&L dashboard - your edge surfaced on every screen.",
  },
  {
    icon: Key,
    title: "Demo mode or API keys",
    body: "Everything works without keys: calculators, tracker, offers and the football simulator. Add optional API keys in .env.local for live fixtures, real lay odds and auto settlement. See Settings → Data & API for status.",
  },
  {
    icon: LayoutDashboard,
    title: "The 60-second demo loop",
    body: "Tracked Events → Simulate match → “2UP drama”. Calculators → Dutching → 2UP dutch → Add to tracker. Link the bet, then watch the Live Dashboard move as goals go in.",
  },
  {
    icon: Trophy,
    title: "Racing Desk for offers",
    body: "Add a place-refund offer, open Racing Desk, and use Intelligence to find qualifying races. Lay button opens the matched calculator; proxy odds are estimates - verify on the bookie before placing.",
  },
] as const;

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  /** G2b - the tour's last step hands off to the setup wizard */
  onSetup?: () => void;
}

/**
 * Tour state lives in the body, which Radix unmounts on close - every open
 * starts at step 0 with the toggle on, no reset effects. The shell mirrors
 * the toggle into a ref so Esc/backdrop dismissal can honour it.
 */
function WelcomeBody({
  finish,
  onSetup,
  onDontShowChange,
}: {
  finish: () => void;
  onSetup?: () => void;
  onDontShowChange: (value: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  // Fresh mount = fresh tour: make sure the shell's mirror starts true too.
  useEffect(() => {
    onDontShowChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <DialogTitle>{current.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {APP_VERSION_LABEL} · Step {step + 1} of {STEPS.length}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>
      <div className="flex justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-colors ${
              i === step ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <Label htmlFor="welcome-dont-show" className="text-xs font-normal text-muted-foreground">
          Don&apos;t show this welcome tour again
        </Label>
        <Switch
          id="welcome-dont-show"
          checked={dontShowAgain}
          onCheckedChange={(v) => {
            setDontShowAgain(v);
            onDontShowChange(v);
          }}
        />
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={finish}>
          Skip
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {isLast ? (
            onSetup ? (
              <>
                <Button variant="outline" size="sm" onClick={finish}>
                  Get started
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    finish();
                    onSetup();
                  }}
                >
                  Set up your desk
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={finish}>
                Get started
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          )}
        </div>
      </DialogFooter>
      {isLast && (
        <div className="flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Link href="/help" className="inline-flex items-center gap-1 text-primary hover:underline">
            <Calculator className="size-3" /> Help guides
          </Link>
          <span>·</span>
          <Link href="/offers" className="inline-flex items-center gap-1 text-primary hover:underline">
            <Gift className="size-3" /> Add an offer
          </Link>
        </div>
      )}
    </>
  );
}

export function WelcomeDialog({ open, onOpenChange, onComplete, onSetup }: WelcomeDialogProps) {
  const dontShowRef = useRef(true);

  const finish = () => {
    if (dontShowRef.current) onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && dontShowRef.current) onComplete();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <WelcomeBody
          finish={finish}
          onSetup={onSetup}
          onDontShowChange={(v) => {
            dontShowRef.current = v;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
