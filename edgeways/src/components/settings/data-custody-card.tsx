"use client";

/**
 * E3 data custody - backup, validated restore (with automatic pre-restore
 * safety copy) and the spreadsheet import wizard. Local-first's lost-laptop
 * story lives here.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/hooks/use-app-state";
import { parseCsv } from "@/lib/import/csv";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  guessMapping,
  mapImportRows,
  type ImportMapping,
  type ImportParseResult,
} from "@/lib/import/bets-import";
import { formatGbp } from "@/lib/format-money";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { DatabaseBackup, FileUp, HardDriveDownload, ShieldCheck } from "lucide-react";
import { OddsmonkeyMark } from "@/components/import/oddsmonkey-mark";
import { PlatformImportDialog } from "@/components/import/platform-import-dialog";
import { detectProfitCsvFormat } from "@/lib/import/oddsmonkey-profits";
import { clearApiGetCache } from "@/lib/api-get-cache";

type RestorePreview = {
  token?: string;
  counts: Record<string, number>;
  /** Hosted desk: no staged token - apply re-posts the file body. */
  hosted?: boolean;
};

/**
 * Parse a JSON API response, but fail loudly when the body is not JSON.
 * A missing route on Vercel returns the 404 HTML page with HTTP 200, and a
 * raw res.json() SyntaxError tells the user nothing.
 */
async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Unexpected response from the server (HTTP ${res.status}). Reload the page and try again.`
    );
  }
}

export function DataCustodyCard({
  onRestored,
  hosted = false,
}: {
  onRestored: () => void;
  hosted?: boolean;
}) {
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [importing, setImporting] = useState(false);
  const [oddsmonkeyOpen, setOddsmonkeyOpen] = useState(false);
  const [oddsmonkeySeed, setOddsmonkeySeed] = useState<string | null>(null);

  async function onRestoreFile(file: File) {
    setValidating(true);
    restoreFileRef.current = file;
    try {
      const res = await fetch("/api/data/restore?mode=preview", {
        method: "POST",
        body: file,
      });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error((json.error as string) ?? "Validation failed");
      setRestorePreview(json as unknown as RestorePreview);
    } catch (e) {
      restoreFileRef.current = null;
      toast.error("Backup rejected", { description: String(e) });
    } finally {
      setValidating(false);
    }
  }

  async function applyRestore() {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      // Hosted: Vercel cannot stage the upload, so send the file again.
      const res = restorePreview.hosted
        ? await fetch("/api/data/restore?mode=apply", {
            method: "POST",
            body: restoreFileRef.current,
          })
        : await fetch(`/api/data/restore?mode=apply&token=${restorePreview.token}`, {
            method: "POST",
          });
      const json = await readJsonResponse(res);
      if (!res.ok) throw new Error((json.error as string) ?? "Restore failed");
      // The restore posts via raw fetch (file body), so the module-level GET
      // cache is never invalidated - without this, History/Accounts keep
      // serving the warm pre-restore responses after the desk is replaced.
      clearApiGetCache();
      setRestorePreview(null);
      restoreFileRef.current = null;
      toast.success("Database restored", {
        description: restorePreview.hosted
          ? "Your hosted desk now matches the backup."
          : "A pre-restore safety copy was saved in data/backups.",
      });
      onRestored();
    } catch (e) {
      toast.error("Restore failed - your data is untouched", { description: String(e) });
    } finally {
      setRestoring(false);
    }
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      toast.error("Nothing to import", { description: "Need a header row plus data rows." });
      return;
    }
    if (detectProfitCsvFormat(rows[0] ?? []) === "oddsmonkey") {
      setOddsmonkeySeed(text);
      setOddsmonkeyOpen(true);
      return;
    }
    setCsvRows(rows);
    setMapping(guessMapping(rows[0]!));
    setImportOpen(true);
  }

  const headers = csvRows[0] ?? [];
  const dataRows = csvRows.slice(1);
  const parsed: ImportParseResult | null =
    mapping && dataRows.length > 0 ? mapImportRows(dataRows, mapping) : null;
  const mappingReady = mapping != null && mapping.date >= 0 && mapping.profit >= 0;

  async function runImport() {
    if (!parsed || parsed.drafts.length === 0) return;
    setImporting(true);
    try {
      const res = await api<{ inserted: number }>("/api/import/bets", {
        method: "POST",
        json: { drafts: parsed.drafts },
      });
      setImportOpen(false);
      toast.success(`Imported ${res.inserted} bet${res.inserted === 1 ? "" : "s"}`, {
        description:
          parsed.errors.length > 0
            ? `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} skipped (unreadable date or profit).`
            : "History only - balances were not changed.",
      });
      onRestored();
    } catch (e) {
      toast.error("Import failed", { description: String(e) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Data custody
        </CardTitle>
        <CardDescription>
          Back up your desk, restore a copy, or bring bet history in from
          Oddsmonkey or a spreadsheet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {hosted ? null : (
          <Button variant="outline" className="justify-start gap-2" asChild>
            <a href="/api/data/backup" download>
              <HardDriveDownload className="size-4" /> Download backup (.db)
            </a>
          </Button>
        )}
        <Button variant="outline" className="justify-start gap-2" asChild>
          <a href="/api/data/backup?format=json" download>
            <HardDriveDownload className="size-4" /> Download backup (JSON)
          </a>
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2"
          disabled={validating}
          onClick={() => restoreInputRef.current?.click()}
        >
          <DatabaseBackup className="size-4" />
          {validating ? "Checking backup…" : "Restore from backup…"}
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2"
          onClick={() => {
            setOddsmonkeySeed(null);
            setOddsmonkeyOpen(true);
          }}
        >
          <OddsmonkeyMark className="size-4" /> Import from Oddsmonkey…
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2"
          onClick={() => importInputRef.current?.click()}
        >
          <FileUp className="size-4" /> Import bets from CSV…
        </Button>
        <p className="text-xs text-muted-foreground">
          {hosted
            ? "Restore replaces your hosted desk with the backup contents. Download a JSON backup first if you want a way back."
            : "Restores always save a pre-restore copy first."}{" "}
          Imported bets are history only - they never change balances and never count
          towards EV capture. Oddsmonkey import is not affiliated with Oddsmonkey.
        </p>

        <input
          ref={restoreInputRef}
          type="file"
          accept={hosted ? ".json,application/json" : ".db,application/octet-stream"}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onRestoreFile(f);
          }}
        />
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onImportFile(f);
          }}
        />

        {/* Restore confirm - a destructive, centred "are you sure" prompt */}
        <Dialog
          open={restorePreview != null}
          onOpenChange={(open) => {
            if (!open) setRestorePreview(null);
          }}
        >
          <DialogContent mobile="center" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {hosted ? "Replace your hosted desk?" : "Replace your database?"}
              </DialogTitle>
              <DialogDescription>
                {hosted
                  ? "Restore this backup. Your current hosted offers, wallets, bets and history are replaced by the backup contents."
                  : "Restore this backup. A safety copy is saved first."}
              </DialogDescription>
            </DialogHeader>
            {restorePreview ? (
              <ul className="text-sm text-muted-foreground">
                {Object.entries(restorePreview.counts).map(([table, n]) => (
                  <li key={table} className="flex justify-between gap-4 tabular-nums">
                    <span className="capitalize">{table.replace(/_/g, " ")}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestorePreview(null)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={restoring} onClick={applyRestore}>
                {restoring ? "Restoring…" : "Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import wizard - map columns, preview, import */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import bets from CSV</DialogTitle>
              <DialogDescription>
                Match your columns. Date and profit are required.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <Label className="shrink-0 text-sm">
                    {IMPORT_FIELD_LABELS[field]}
                    {field === "date" || field === "profit" ? " *" : ""}
                  </Label>
                  <Select
                    value={String(mapping?.[field] ?? -1)}
                    onValueChange={(v) =>
                      setMapping((m) => (m ? { ...m, [field]: Number(v) } : m))
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">Not in file</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {parsed ? (
              <div className="rounded-md border px-3 py-2 text-sm">
                {mappingReady ? (
                  <>
                    <p>
                      <span className="font-medium tabular-nums">{parsed.drafts.length}</span>{" "}
                      bets ready
                      {parsed.errors.length > 0 ? (
                        <span className="text-warning">
                          {" "}
                          · {parsed.errors.length} row
                          {parsed.errors.length === 1 ? "" : "s"} unreadable (skipped)
                        </span>
                      ) : null}
                    </p>
                    {parsed.drafts.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        First: {parsed.drafts[0]!.label} ·{" "}
                        {formatGbp(parsed.drafts[0]!.actualProfit)} · total{" "}
                        {formatGbp(
                          parsed.drafts.reduce((s, d) => s + d.actualProfit, 0)
                        )}{" "}
                        across the file
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">Map the date and profit columns to continue.</p>
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                {...pageSecondaryButtonProps}
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                {...pagePrimaryButtonProps}
                disabled={!mappingReady || importing || (parsed?.drafts.length ?? 0) === 0}
                onClick={runImport}
              >
                {importing
                  ? "Importing…"
                  : `Import ${parsed?.drafts.length ?? 0} bet${(parsed?.drafts.length ?? 0) === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
    <PlatformImportDialog
      open={oddsmonkeyOpen}
      onOpenChange={(next) => {
        setOddsmonkeyOpen(next);
        if (!next) setOddsmonkeySeed(null);
      }}
      seedText={oddsmonkeySeed}
      onImported={onRestored}
    />
    </>
  );
}
