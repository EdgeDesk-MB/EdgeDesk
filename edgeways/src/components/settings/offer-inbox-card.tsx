"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Inbox, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { api } from "@/hooks/use-app-state";
import { cn } from "@/lib/utils";

interface OfferInboxStatus {
  enabled: boolean;
  address: string | null;
  createdAt: number | null;
  totalReceived: number;
  lastReceivedAt: number | null;
  /** False while the feature is admin-gated and this desk is not admin. */
  available?: boolean;
}

/**
 * Offer inbox (email forwarding) settings card. Opt-in: enabling creates
 * the desk's unique offers+<token>@ address; forwarded bookmaker emails
 * land as Planned offers. Regenerate is a two-step confirm because the old
 * address dies the moment the new one exists.
 */
export function OfferInboxCard() {
  const [status, setStatus] = useState<OfferInboxStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const rotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api<OfferInboxStatus>("/api/settings/offer-inbox"));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    // Defer a microtask so hydration settles first (same as push control).
    queueMicrotask(() => {
      void load();
    });
    return () => {
      if (rotateTimer.current) clearTimeout(rotateTimer.current);
    };
  }, [load]);

  async function act(action: "enable" | "rotate" | "disable" | "test") {
    setBusy(action);
    try {
      const result = await api<OfferInboxStatus & { status?: string }>(
        "/api/settings/offer-inbox",
        {
          method: "POST",
          json: { action },
        }
      );
      if (action === "test") {
        if (result.status === "drafted") {
          toast.success("Test offer received", {
            description: "Waiting as Planned on the Offers page.",
          });
        } else {
          toast.error("Test email did not parse", {
            description: `Status: ${result.status}`,
          });
        }
      } else {
        setStatus(result);
        if (action === "enable") toast.success("Offer inbox is on");
        if (action === "rotate") toast.success("New address created", {
          description: "The old address has stopped working.",
        });
        if (action === "disable") toast.success("Offer inbox is off");
      }
    } catch (e) {
      toast.error("Offer inbox update failed", { description: String(e) });
    } finally {
      setBusy(null);
      setConfirmingRotate(false);
    }
  }

  async function copyAddress() {
    if (!status?.address) return;
    try {
      await navigator.clipboard.writeText(status.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the address");
    }
  }

  function onRotate() {
    if (!confirmingRotate) {
      setConfirmingRotate(true);
      rotateTimer.current = setTimeout(() => setConfirmingRotate(false), 4000);
      return;
    }
    if (rotateTimer.current) clearTimeout(rotateTimer.current);
    void act("rotate");
  }

  // Admin-gated rollout: the card simply does not exist for other desks.
  if (status?.available === false) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="size-4" /> Offer inbox
        </CardTitle>
        <CardDescription>
          Forward bookmaker offer emails to your own Edgeways address and they
          land as Planned offers, ready to review. Only forward offer emails,
          they are parsed automatically and the raw email is not kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:max-w-xl">
        {status === null ? (
          <p className="min-w-0 text-xs text-muted-foreground text-pretty break-words">Loading…</p>
        ) : !status.enabled ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Email forwarding is off</p>
              <p className="text-xs text-muted-foreground text-pretty break-words">
                Turn it on to get your personal forwarding address.
              </p>
            </div>
            <Button
              {...pagePrimaryButtonProps}
              className="shrink-0"
              disabled={busy !== null}
              onClick={() => void act("enable")}
            >
              Turn on
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Your forwarding address</p>
              <div className="flex items-start gap-2">
                <code
                  className="min-w-0 flex-1 select-all break-all rounded-md border bg-muted/60 px-3 py-2 font-mono text-xs tabular-nums dark:bg-input/30"
                  title={status.address ?? undefined}
                >
                  {status.address}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Copy forwarding address"
                  onClick={() => void copyAddress()}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <p className="min-w-0 text-xs text-muted-foreground text-pretty break-words">
                {status.totalReceived === 0
                  ? "Nothing forwarded yet. Send yourself a test to see it land."
                  : `${status.totalReceived} email${status.totalReceived === 1 ? "" : "s"} received so far.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => void act("test")}
              >
                <Send className="size-3.5" /> Send a test offer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("gap-1.5", confirmingRotate && "text-warning")}
                disabled={busy !== null}
                onClick={onRotate}
              >
                <RotateCcw className="size-3.5" />
                {confirmingRotate ? "Tap again to replace" : "New address"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void act("disable")}
              >
                Turn off
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
