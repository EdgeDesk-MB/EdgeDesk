"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/hooks/use-app-state";
import {
  currentPlaybookStep,
  playbookFromOffer,
  playbookProgress,
} from "@/lib/offers/offer-playbook";
import { readImportantTerms } from "@/lib/offers/offer-terms";
import type { AccountBalance } from "@/lib/services/balances.types";
import type { OfferSummary } from "@/lib/services/offers.types";
import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Active completion step — guidance only.
 * Primary actions live on the Campaign details footer (or list View), not here.
 * Allowed: copy codes, pointers, WR context.
 */
export function OfferPlaybookPanel({
  offer,
  className,
  onPointerDown,
}: {
  offer: OfferSummary;
  /** @deprecated unused — kept so call sites need not churn mid-HMR */
  onRefresh?: () => void;
  onTrackQualify?: () => void;
  onTrackConvert?: () => void;
  className?: string;
  onPointerDown?: (e: MouseEvent | KeyboardEvent) => void;
}) {
  const [wrLeft, setWrLeft] = useState<number | null>(null);
  const important = readImportantTerms(offer);

  const { playbook, step, progress } = useMemo(() => {
    const synced = playbookFromOffer(offer);
    if (!synced) return { playbook: null, step: null, progress: null };
    return {
      playbook: synced,
      step: currentPlaybookStep(synced),
      progress: playbookProgress(synced),
    };
  }, [offer]);

  const wrBookie =
    step?.kind === "clear_wagering" && offer.bookmaker?.trim()
      ? offer.bookmaker.trim().toLowerCase()
      : null;
  const [prevWrBookie, setPrevWrBookie] = useState(wrBookie);
  if (prevWrBookie !== wrBookie) {
    setPrevWrBookie(wrBookie);
    if (wrBookie === null) setWrLeft(null);
  }

  useEffect(() => {
    if (wrBookie === null) return;
    let cancelled = false;
    void apiGet<{ accounts: AccountBalance[] }>("/api/accounts")
      .then((res) => {
        if (cancelled) return;
        const account = res.accounts.find(
          (a) => a.type === "bookie" && a.name.trim().toLowerCase() === wrBookie
        );
        setWrLeft(account?.wrRemaining ?? null);
      })
      .catch(() => {
        if (!cancelled) setWrLeft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wrBookie, offer.id]);

  if (offer.deskProgress) return null;
  if (!playbook || !step || !progress) return null;
  if (offer.status === "completed" || offer.status === "expired") return null;
  if (step.kind === "done" && step.status === "done") return null;

  const wrDetail =
    step.kind === "clear_wagering" && wrLeft != null && wrLeft > 0.005
      ? `WR £${wrLeft.toFixed(2)} left on ${offer.bookmaker}. Place cash bets to burn it, then mark cleared in the footer.`
      : step.kind === "clear_wagering"
        ? "When wagering hits £0, mark it cleared with the footer button."
        : null;

  async function copyCode() {
    const code = important.promoCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error("Could not copy code");
    }
  }

  return (
    <div
      className={cn(className)}
      onClick={onPointerDown}
      onKeyDown={onPointerDown}
    >
      <div
        role="region"
        aria-label={`Completion step: ${step.title}`}
        className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/35 px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            {progress.label}
          </p>
          {step.kind === "deposit" && important.promoCode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 font-semibold tracking-wide"
              onClick={() => void copyCode()}
              aria-label={`Copy promo code ${important.promoCode}`}
            >
              {important.promoCode}
              <Copy className="size-3.5 opacity-70" />
            </Button>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-semibold leading-snug text-foreground">{step.title}</p>
          {wrDetail || step.detail ? (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {wrDetail ?? step.detail}
            </p>
          ) : null}
        </div>
        {step.kind === "clear_wagering" ? (
          <p className="text-xs text-muted-foreground">
            <Link
              href="/accounts"
              className="font-medium text-primary-text underline-offset-2 hover:underline"
            >
              Open Accounts
            </Link>
            {" · "}
            check remaining WR on {offer.bookmaker ?? "this bookie"}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** True when the playbook is the primary “what now” UI (soften pipeline chrome). */
export function offerPlaybookIsPrimary(offer: OfferSummary): boolean {
  if (offer.deskProgress) return false;
  const raw = playbookFromOffer(offer);
  if (!raw) return false;
  if (offer.status === "completed" || offer.status === "expired") return false;
  const step = currentPlaybookStep(raw);
  return step != null && step.kind !== "done";
}
