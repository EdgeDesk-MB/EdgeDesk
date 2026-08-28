"use client";

import type { MouseEvent, ReactNode } from "react";
import { Check, Star } from "lucide-react";
import type { PlanId } from "@/lib/entitlements/plans";
import { listRowSelected } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function SkillMark({
  level,
  selected,
}: {
  level: 1 | 2 | 3 | 4;
  selected: boolean;
}) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const pct = level / 4;
  return (
    <span
      className="relative inline-flex size-8 shrink-0 items-center justify-center"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-8 -rotate-90">
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          className="stroke-border"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          className="stroke-brand"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <Star
        className={cn(
          "size-3.5 text-primary-text",
          selected ? "fill-brand" : "fill-brand/80"
        )}
      />
    </span>
  );
}

export function selectedTickTone(
  required: PlanId,
  current: PlanId | null
): "included" | "core" | "edge" {
  const have = current ?? "free";
  if (required === "free" || have === "edge") return "included";
  if (required === "core") return have === "core" ? "included" : "core";
  return "edge";
}

export function CheckMark({
  selected,
  tone = "core",
}: {
  selected: boolean;
  tone?: "included" | "core" | "edge";
}) {
  return (
    <span
      className={cn(
        "flex size-3 shrink-0 items-center justify-center rounded-sm ring-1",
        selected
          ? tone === "included"
            ? "bg-success text-white ring-success"
            : tone === "edge"
              ? "bg-edge text-edge-foreground ring-edge"
              : "bg-brand text-brand-foreground ring-brand"
          : "bg-card ring-border"
      )}
      aria-hidden
    >
      {selected ? <Check className="size-3" /> : null}
    </span>
  );
}

const choiceClassName = (
  selected: boolean,
  compact: boolean | undefined
) =>
  cn(
    listRowSelected(selected),
    "flex w-full min-w-0 touch-manipulation items-start text-left",
    compact ? "min-h-11 gap-2.5 px-3 py-2.5" : "gap-3 px-3 py-3 sm:px-4 sm:py-3.5",
    !selected && "border-border/80"
  );

function ChoiceInner({
  title,
  body,
  leading,
  trailing,
  compact,
}: {
  title: string;
  body?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  return (
    <>
      {leading ? (
        <span
          className={cn(
            "flex shrink-0 items-center",
            compact ? "h-5 mt-px" : "mt-0.5"
          )}
        >
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-sm font-medium text-pretty break-words",
              compact && "leading-5"
            )}
          >
            {title}
          </span>
          {trailing}
        </span>
        {body ? (
          <span
            className={cn(
              "block text-xs leading-snug text-muted-foreground text-pretty break-words",
              compact ? "mt-0" : "mt-1"
            )}
          >
            {body}
          </span>
        ) : null}
      </span>
    </>
  );
}

export function ChoiceButton({
  selected,
  tabStop,
  title,
  body,
  onClick,
  role,
  leading,
  trailing,
  compact,
  readOnly,
}: {
  selected: boolean;
  tabStop?: boolean;
  title: string;
  body?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  role: "radio" | "checkbox";
  leading?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const inner = (
    <ChoiceInner
      title={title}
      body={body}
      leading={leading}
      trailing={trailing}
      compact={compact}
    />
  );

  if (readOnly) {
    return (
      <div
        role={role}
        aria-checked={selected}
        aria-disabled
        className={choiceClassName(selected, compact)}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      tabIndex={tabStop ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (role !== "radio") return;
        if (
          event.key !== "ArrowDown" &&
          event.key !== "ArrowUp" &&
          event.key !== "ArrowRight" &&
          event.key !== "ArrowLeft"
        ) {
          return;
        }
        event.preventDefault();
        const root = event.currentTarget.closest("[role='radiogroup']");
        if (!root) return;
        const radios = [
          ...root.querySelectorAll<HTMLButtonElement>("[role='radio']"),
        ];
        const i = radios.indexOf(event.currentTarget);
        if (i < 0) return;
        const delta =
          event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const next = radios[(i + delta + radios.length) % radios.length];
        next?.click();
        requestAnimationFrame(() => next?.focus());
      }}
      className={cn(
        choiceClassName(selected, compact),
        "outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        "active:bg-selection-subtle"
      )}
    >
      {inner}
    </button>
  );
}
