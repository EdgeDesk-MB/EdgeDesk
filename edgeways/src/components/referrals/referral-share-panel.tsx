"use client";

import { useEffect, useState } from "react";
import { Gift, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { captureReferralShared } from "@/lib/analytics/referrals";
import { REFERRAL_PITCH } from "@/lib/referrals/prompt";
import { cn } from "@/lib/utils";
import {
  campaignFbBadge,
  edgePanel,
  sectionDescription,
} from "@/lib/ui/surface-styles";

type ReferralMine = {
  code: string;
  shareUrl: string;
};

export function useReferralShare(surface: string) {
  const [referral, setReferral] = useState<ReferralMine | null>(null);
  const [failed, setFailed] = useState(false);

  function load() {
    fetch("/api/referrals/mine")
      .then((response) => {
        if (!response.ok) throw new Error("load failed");
        return response.json() as Promise<ReferralMine>;
      })
      .then((data) => {
        setFailed(false);
        setReferral(data);
      })
      .catch(() => setFailed(true));
  }

  useEffect(() => {
    load();
  }, []);

  function retry() {
    setFailed(false);
    setReferral(null);
    load();
  }

  async function copyLink(): Promise<boolean> {
    if (!referral) return false;
    try {
      await navigator.clipboard.writeText(referral.shareUrl);
      captureReferralShared({ surface });
      toast.success("Referral link copied", {
        description: "Share it with a friend to earn £10 credit.",
      });
      return true;
    } catch {
      toast.error("Could not copy the link", {
        description: "Select the sign-up URL below and copy it yourself.",
      });
      return false;
    }
  }

  return { referral, failed, retry, copyLink };
}

export function ReferralCodeChip({
  code,
  failed,
}: {
  code: string | null;
  failed: boolean;
}) {
  const loading = !failed && code == null;
  const label = failed
    ? "Referral code unavailable"
    : loading
      ? "Loading referral code"
      : `Your referral code, ${code}`;

  return (
    <code
      aria-busy={loading || undefined}
      aria-label={label}
      className={cn(
        "inline-flex h-8 min-w-[11ch] items-center justify-center rounded-md border px-3 font-mono text-sm font-bold tracking-widest max-sm:h-10",
        campaignFbBadge
      )}
    >
      {failed ? "----" : (code ?? "…")}
    </code>
  );
}

/** Settings subscription card. Same share action as the homepage prompt. */
export function ReferralSharePanel() {
  const { referral, failed, retry, copyLink } = useReferralShare("settings");

  return (
    <div className={edgePanel}>
      <div className="relative flex flex-col gap-3 overflow-hidden px-3 py-3">
        <TicketPercent
          aria-hidden
          className="pointer-events-none absolute -right-4 top-1/2 size-28 -translate-y-1/2 -rotate-12 text-edge/15"
        />
        <div className="relative flex items-center gap-2">
          <Gift className="size-4 text-edge" aria-hidden />
          <p className="text-sm font-semibold">Refer a friend</p>
        </div>
        <p className={cn(sectionDescription, "relative")}>{REFERRAL_PITCH}</p>
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center">
          <ReferralCodeChip code={referral?.code ?? null} failed={failed} />
          {failed ? (
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          ) : (
            <Button
              variant="edge"
              disabled={!referral}
              aria-busy={!referral || undefined}
              onClick={() => void copyLink()}
            >
              {referral ? "Copy referral link" : "Loading referral link"}
            </Button>
          )}
        </div>
        {failed ? (
          <p className={cn(sectionDescription, "relative")} role="alert">
            Could not load your referral code.
          </p>
        ) : null}
        {referral && !failed ? (
          <p className={cn(sectionDescription, "relative select-all break-all")}>
            {referral.shareUrl}
          </p>
        ) : null}
      </div>
    </div>
  );
}
