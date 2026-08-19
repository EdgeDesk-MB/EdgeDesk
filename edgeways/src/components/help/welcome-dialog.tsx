"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
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
    body: "Calculators, offers, and live P&L.",
    help: "We do not send bookie offers.",
  },
  {
    icon: Key,
    title: "Demo or live keys",
    body: "Works without keys.",
    help: "Add API keys in Settings when you want live data.",
  },
  {
    icon: LayoutDashboard,
    title: "The 60-second loop",
    body: "Simulate, dutch, add, watch.",
    help: "The same loop you will run every day.",
  },
  {
    icon: Trophy,
    title: "Racing Desk",
    body: "Find a qualifier from an offer.",
    help: "Add a place-refund offer, then use Race picks to find a qualifier.",
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
        <DialogTitle className="flex items-center gap-2.5">
          <Icon className={cn(dialogTitleIcon, "text-primary-text")} />
          {current.title}
        </DialogTitle>
        <DialogDescription
          explainer={
            <DialogExplainer label="More about this step">{current.help}</DialogExplainer>
          }
        >
          {current.body}
        </DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">
        {APP_VERSION_LABEL} · Step {step + 1} of {STEPS.length}
      </p>
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
          <Link href="/help" className="inline-flex items-center gap-1 text-primary-text hover:underline">
            <Calculator className="size-3" /> Help guides
          </Link>
          <span>·</span>
          <Link href="/offers" className="inline-flex items-center gap-1 text-primary-text hover:underline">
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
