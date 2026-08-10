"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ACCA_METHOD_HELP, type AccaMethod } from "@/content/help/acca-methods";
import { cn } from "@/lib/utils";

const METHOD_ORDER: AccaMethod[] = [
  "sequential",
  "insurance_legs",
  "insurance_whole",
  "combined",
];

/** Help modal for Acca methods - used from create run and run cards. */
export function AccaMethodHelpDialog({
  focus,
  trigger = "link",
  className,
}: {
  focus: AccaMethod;
  /** link = "Learn more" text; icon = compact CircleHelp button */
  trigger?: "link" | "icon";
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger === "icon" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-6 text-muted-foreground hover:text-foreground",
              className
            )}
            aria-label="Learn more about Acca methods"
          >
            <CircleHelp className="size-3" />
          </Button>
        ) : (
          <button
            type="button"
            className={cn(
              "font-semibold text-black/80 underline decoration-black/30 underline-offset-2 hover:decoration-black/60 dark:text-white/90 dark:decoration-white/40 dark:hover:decoration-white/70",
              className
            )}
          >
            Learn more
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acca methods</DialogTitle>
          <DialogDescription>
            Pick the method that matches your offer. Enter live exchange lay odds and stake on the next
            ready leg.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {METHOD_ORDER.map((key) => {
            const help = ACCA_METHOD_HELP[key];
            const active = key === focus;
            return (
              <div
                key={key}
                className={
                  active
                    ? "rounded-lg border border-border bg-selection-subtle/60 px-3 py-2.5"
                    : "rounded-lg border border-transparent px-3 py-2.5"
                }
              >
                <p className="text-sm font-semibold text-foreground">
                  {help.label}
                  {active ? (
                    <span className="ml-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Selected
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{help.blurb}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/80">When: </span>
                  {help.when}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {help.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
