"use client";

import { useId } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  summary,
  open,
  onOpenChange,
  children,
  accent,
  icon,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  const panelId = useId();
  const headerClass = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors motion-reduce:transition-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    accent
      ? "rounded-t-lg bg-warning/10 text-warning hover:bg-warning/15"
      : "rounded-t-lg bg-muted/50 hover:bg-muted/70 dark:bg-input/30 dark:hover:bg-input/45",
    !open && "rounded-b-lg"
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        accent
          ? "border-warning/40 bg-warning/5"
          : "border-border/70 bg-muted/20 dark:bg-input/20"
      )}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={headerClass}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold tracking-wide",
            accent ? "text-warning" : "text-foreground"
          )}
        >
          {accent ? (
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          ) : icon ? (
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              {icon}
            </span>
          ) : null}
          {title}
        </span>
        {!open && summary ? (
          <span
            className="max-w-[55%] truncate text-xs text-muted-foreground"
            title={summary}
          >
            {summary}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          className="flex flex-col gap-2 border-t border-border/50 px-3 py-2.5"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
