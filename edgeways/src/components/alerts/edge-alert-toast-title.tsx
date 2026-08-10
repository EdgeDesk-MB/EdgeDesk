"use client";

import type { ReactNode } from "react";
import { VenueBadge } from "@/components/venue-badge";
import { cn } from "@/lib/utils";

/** Win: "You just made £7.62" (+ optional " · Bet won"). */
const WIN_MADE_RE =
  /^(You just made )(£[\d,]+\.\d{2})!?((?: · .+)?)$/u;
/** Loss: "-£1.51 settled" (+ optional " · Bet lost"; optional leading polarity emoji). */
const LOSS_SETTLED_RE =
  /^(?:🔴\s*)?(-£[\d,]+\.\d{2})\s+(settled)((?: · .+)?)$/u;

function toneClass(tone: "positive" | "negative"): string {
  return tone === "positive"
    ? "edge-alert-toast-amount-positive"
    : "edge-alert-toast-amount-negative";
}

function titleCopy(title: string): ReactNode {
  const win = title.match(WIN_MADE_RE);
  if (win) {
    const [, lead, amount, suffix] = win;
    return (
      <>
        <span className="edge-alert-toast-title-lead">{lead}</span>
        <span className={cn("tabular-nums font-semibold", toneClass("positive"))}>
          {amount}
        </span>
        {suffix ? (
          <span className="edge-alert-toast-title-lead">{suffix}</span>
        ) : null}
      </>
    );
  }

  const loss = title.match(LOSS_SETTLED_RE);
  if (loss) {
    const [, amount, rest, suffix] = loss;
    return (
      <>
        <span className={cn("tabular-nums font-semibold", toneClass("negative"))}>
          {amount}
        </span>{" "}
        <span className="edge-alert-toast-title-lead">{rest}</span>
        {suffix ? (
          <span className="edge-alert-toast-title-lead">{suffix}</span>
        ) : null}
      </>
    );
  }

  return <span className="edge-alert-toast-title-lead">{title}</span>;
}

/**
 * Toast title: settlement amount colouring, optional bookie pill on its own
 * line above the title. Body stays plain text.
 */
export function EdgeAlertToastTitle({
  title,
  tone,
  bookmaker,
}: {
  title: string;
  tone?: "positive" | "negative" | null;
  bookmaker?: string | null;
}) {
  void tone;
  const bookie = bookmaker?.trim();
  const copy = titleCopy(title);

  if (!bookie) return <span>{copy}</span>;

  return (
    <span className="flex max-w-full flex-col items-start gap-1">
      <VenueBadge name={bookie} size="sm" className="shrink-0" />
      <span className="min-w-0">{copy}</span>
    </span>
  );
}
