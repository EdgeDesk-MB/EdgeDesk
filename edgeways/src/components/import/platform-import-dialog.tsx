"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
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
import { OddsmonkeyMark } from "@/components/import/oddsmonkey-mark";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";
import { api } from "@/hooks/use-app-state";
import { formatEvGbp } from "@/lib/format-money";
import {
  detectProfitCsvFormat,
  oddsmonkeyPreview,
  parseOddsmonkeyProfits,
  type OddsmonkeyParseResult,
} from "@/lib/import/oddsmonkey-profits";
import { receiptDateLabel } from "@/lib/billing/receipt-view";

const CHUNK = 50;

function dateRangeLabel(from: number | null, to: number | null): string | null {
  if (from == null) return null;
  const start = receiptDateLabel(Math.floor(from / 1000));
  if (to == null || to === from) return start;
  return `${start} to ${receiptDateLabel(Math.floor(to / 1000))}`;
}

export function PlatformImportDialog({
  open,
  onOpenChange,
  onImported,
  seedText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
  seedText?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<OddsmonkeyParseResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  function applyText(text: string): boolean {
    const rows = text.split(/\r?\n/, 1);
    const headers = (rows[0] ?? "").split(",").map((h) => h.trim());
    if (detectProfitCsvFormat(headers) !== "oddsmonkey") {
      toast.error("Not an Oddsmonkey profits file", {
        description: "Export Data from the Oddsmonkey profit tracker, then try again.",
      });
      return false;
    }
    const next = parseOddsmonkeyProfits(text);
    if (next.drafts.length === 0) {
      toast.error("Nothing to import", {
        description: next.errors[0]?.message ?? "No readable rows.",
      });
      return false;
    }
    setParsed(next);
    setProgress(null);
    return true;
  }

  const seedKey = open && seedText ? seedText : null;
  const [prevSeedKey, setPrevSeedKey] = useState<string | null>(null);
  if (prevSeedKey !== seedKey) {
    setPrevSeedKey(seedKey);
    if (seedKey != null) {
      const next = parseOddsmonkeyProfits(seedKey);
      if (next.drafts.length > 0) {
        setParsed(next);
        setProgress(null);
      }
    }
  }

  const preview = parsed ? oddsmonkeyPreview(parsed) : null;
  const previewRange = preview
    ? dateRangeLabel(preview.from, preview.to)
    : null;

  async function onFile(file: File) {
    applyText(await file.text());
  }

  async function commit() {
    if (!parsed || parsed.drafts.length === 0) return;
    setBusy(true);
    const total = parsed.drafts.length;
    let inserted = 0;
    let skipped = 0;
    try {
      for (let i = 0; i < parsed.drafts.length; i += CHUNK) {
        const chunk = parsed.drafts.slice(i, i + CHUNK);
        const res = await api<{ inserted: number; skipped: number }>(
          "/api/import/platform",
          { method: "POST", json: { drafts: chunk } }
        );
        inserted += res.inserted;
        skipped += res.skipped;
        setProgress({ done: Math.min(i + chunk.length, total), total });
      }
      toast.success(
        `Imported ${inserted} row${inserted === 1 ? "" : "s"}`,
        {
          description:
            skipped > 0
              ? `${skipped} already on the desk were skipped. History only, balances unchanged.`
              : "History only, balances unchanged. Not affiliated with Oddsmonkey.",
        }
      );
      setParsed(null);
      onOpenChange(false);
      onImported?.();
    } catch (e) {
      toast.error("Import failed", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          if (!next) setParsed(null);
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <OddsmonkeyMark className={dialogTitleIcon} />
              Import from Oddsmonkey
            </DialogTitle>
            <DialogDescription
              explainer={
                <DialogExplainer title="Import from Oddsmonkey">
                  Uses the profits CSV from Oddsmonkey Export Data. One row is net
                  P&amp;L, not a reconstructed matched ticket. Edgeways is not
                  affiliated with Oddsmonkey.
                </DialogExplainer>
              }
            >
              Profit history only.
            </DialogDescription>
          </DialogHeader>

          {parsed && preview ? (
            <div className="space-y-3 text-sm">
              <p>
                {preview.rows} row{preview.rows === 1 ? "" : "s"} ·{" "}
                {formatEvGbp(preview.profitSum, { signed: true })}
                {previewRange ? ` · ${previewRange}` : ""}
              </p>
              {preview.skipped > 0 ? (
                <p className="text-muted-foreground">
                  {preview.skipped} row{preview.skipped === 1 ? "" : "s"} skipped
                  (unreadable date or profit).
                </p>
              ) : null}
              {parsed.unmappedBetTypes.length > 0 ? (
                <p className="text-muted-foreground text-pretty">
                  Unmapped bet types kept as history:{" "}
                  {parsed.unmappedBetTypes.join(", ")}.
                </p>
              ) : null}
              {progress ? (
                <p role="status" aria-live="polite" className="tabular-nums">
                  {progress.done} / {progress.total} rows completed
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Edgeways is not affiliated with Oddsmonkey.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose the CSV from Oddsmonkey → Profit Tracker → Export Data.
              Outplayed import lands once we have a sample file.
            </p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              {...pageSecondaryButtonProps}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" />
              Choose CSV
            </Button>
            <Button
              {...pagePrimaryButtonProps}
              disabled={busy || !parsed || parsed.drafts.length === 0}
              onClick={() => void commit()}
            >
              {busy ? "Importing…" : "Import history"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
