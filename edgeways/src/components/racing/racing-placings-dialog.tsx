"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BetRow, EventRow } from "@/lib/db/schema";
import {
  buildRaceResultDialogHeader,
  isRaceResultIncomplete,
  parseRaceResults,
  parseRacecardRunners,
} from "@/lib/racing";
import { formatDecimalOdds, fractionalToDecimal } from "@/lib/racing/odds";
import { buildRacingResultsLinks } from "@/lib/racing/results-link";
import {
  parseRaceResultText,
  type SpFavouritePlace,
} from "@/lib/racing/parse-race-result-text";
import { matchOcrToRunner } from "@/lib/ocr/match-runner";
import { ocrRaceResultScreenshot } from "@/lib/ocr/extract-text";
import { cn } from "@/lib/utils";
import { ChevronDown, ClipboardPaste, ExternalLink, Loader2, ScanLine } from "lucide-react";

export type PlacingsPayload = {
  winner: string;
  runners: {
    horse: string;
    position: number;
    spDecimal?: number;
    spLabel?: string;
    isSpFavourite?: boolean;
  }[];
};

type PlaceRow = {
  horse: string;
  spText: string;
};

const EMPTY_ROWS: PlaceRow[] = [
  { horse: "", spText: "" },
  { horse: "", spText: "" },
  { horse: "", spText: "" },
  { horse: "", spText: "" },
];

const ghostInputClass =
  "m-0 w-full min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-foreground shadow-none outline-none ring-0 placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0";

function collectImageFiles(
  source: DataTransferItemList | FileList | null | undefined
): File[] {
  if (!source) return [];
  const files: File[] = [];
  if (source instanceof FileList) {
    for (const f of Array.from(source)) {
      if (f.type.startsWith("image/")) files.push(f);
    }
    return files;
  }
  for (const item of Array.from(source)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return files;
}

function horseEquals(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function spTextFromDecimal(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 1) return "";
  return formatDecimalOdds(n);
}

function parseSpInput(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (t.includes("/")) return fractionalToDecimal(t);
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

export function RacingPlacingsDialog({
  event,
  linkedBets,
  incomplete,
  onRecord,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: {
  event: EventRow;
  linkedBets: BetRow[];
  incomplete?: boolean;
  onRecord: (payload: PlacingsPayload) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const existing = parseRaceResults(event.goals);
  const cardRunners = parseRacecardRunners(event.goals);
  const selectionHints = [
    ...new Set(linkedBets.map((b) => b.selection?.trim()).filter(Boolean) as string[]),
  ];

  const [rows, setRows] = useState<PlaceRow[]>(EMPTY_ROWS);
  /** Which of 1st–4th is the SP favourite (tag + settle mark). */
  const [spFavouritePlace, setSpFavouritePlace] = useState<SpFavouritePlace | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsLinks = buildRacingResultsLinks(event);

  function updateRow(index: number, patch: Partial<PlaceRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function hydrate() {
    const byPos = (n: number) => existing?.runners.find((r) => r.position === n);
    const winner = byPos(1)?.horse || existing?.winner || "";
    let secondVal = byPos(2)?.horse ?? "";
    if (
      !secondVal &&
      existing &&
      isRaceResultIncomplete(existing) &&
      selectionHints[0] &&
      !horseEquals(selectionHints[0], winner)
    ) {
      secondVal = selectionHints[0];
    }
    setRows([
      { horse: winner, spText: spTextFromDecimal(byPos(1)?.spDecimal) },
      { horse: secondVal, spText: spTextFromDecimal(byPos(2)?.spDecimal) },
      { horse: byPos(3)?.horse ?? "", spText: spTextFromDecimal(byPos(3)?.spDecimal) },
      { horse: byPos(4)?.horse ?? "", spText: spTextFromDecimal(byPos(4)?.spDecimal) },
    ]);
    const favRunner = existing?.runners.find(
      (r) => r.isSpFavourite && r.position >= 1 && r.position <= 4
    );
    setSpFavouritePlace(favRunner ? (favRunner.position as SpFavouritePlace) : null);
  }

  const applyParsed = useCallback(
    (parsed: ReturnType<typeof parseRaceResultText>, source: "paste" | "ocr") => {
      if (!parsed?.first) {
        toast.error(
          source === "ocr" ? "Couldn’t read that result image" : "Couldn’t read that paste",
          {
            description:
              source === "ocr"
                ? "Try a clearer crop of 1st–4th, or paste the result text instead."
                : "Include the finishing order with horse names (1st–4th).",
          }
        );
        return;
      }
      const resolve = (name: string) => {
        if (!name.trim()) return "";
        const match = matchOcrToRunner(name, cardRunners);
        return match?.runner ?? name;
      };
      const names = [parsed.first, parsed.second, parsed.third, parsed.fourth];
      setRows(
        names.map((name, i) => {
          const place = (i + 1) as SpFavouritePlace;
          const sp = parsed.spDecimals?.[place];
          return {
            horse: name ? resolve(name) : "",
            spText: spTextFromDecimal(sp),
          };
        })
      );
      if (parsed.spFavouritePlace) {
        setSpFavouritePlace(parsed.spFavouritePlace);
      } else if (parsed.winnerIsSpFavourite) {
        setSpFavouritePlace(1);
      }
      const filled = names.filter(Boolean).length;
      toast.success(
        filled === 1
          ? "Filled the winner - check the rest"
          : `Filled ${filled} places - double-check before saving`
      );
    },
    [cardRunners]
  );

  const runOcr = useCallback(
    async (file: File) => {
      setOcrBusy(true);
      try {
        const { text } = await ocrRaceResultScreenshot(file);
        applyParsed(parseRaceResultText(text), "ocr");
      } catch (e) {
        toast.error("Couldn’t read that image", { description: String(e) });
      } finally {
        setOcrBusy(false);
      }
    },
    [applyParsed]
  );

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target;
      const images = collectImageFiles(e.clipboardData?.items);
      if (images.length > 0) {
        e.preventDefault();
        void runOcr(images[0]!);
        return;
      }
      if (
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLInputElement)
      ) {
        const pasted = e.clipboardData?.getData("text/plain")?.trim();
        if (pasted) {
          e.preventDefault();
          applyParsed(parseRaceResultText(pasted), "paste");
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, runOcr, applyParsed]);

  const firstHorse = rows[0]?.horse.trim() ?? "";
  const horseOptions = [...new Set([...selectionHints, ...cardRunners])];
  const runnersListId = `runners-${event.id}`;
  const raceHeader = buildRaceResultDialogHeader(event);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) hydrate();
        else {
          setOcrBusy(false);
          setDragOver(false);
        }
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Race result</DialogTitle>
          <DialogDescription>
            Enter 1st–4th, or paste a result / screenshot. Click a # to mark SP favourite.
          </DialogDescription>
        </DialogHeader>

        {resultsLinks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {resultsLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                {link.label}
                <ExternalLink className="size-3.5 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-3 text-center transition-colors",
            dragOver
              ? "border-primary/50 bg-primary/5"
              : "border-muted-foreground/25 bg-muted/20",
            ocrBusy && "pointer-events-none opacity-70"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const images = collectImageFiles(e.dataTransfer.files);
            if (images[0]) void runOcr(images[0]);
          }}
        >
          {ocrBusy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <ScanLine className="size-4 text-muted-foreground" />
          )}
          <p className="text-[11px] text-muted-foreground">
            {ocrBusy
              ? "Reading result…"
              : "Paste a result or drop a screenshot (⌘V)"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={ocrBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <ClipboardPaste className="size-3.5" />
              Choose image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void runOcr(file);
              }}
            />
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card">
          <div className="border-b border-border/50 bg-muted/30 px-2.5 py-2">
            <p className="text-sm font-semibold uppercase leading-snug text-foreground">
              {raceHeader.title}
            </p>
            {(raceHeader.metaParts.length > 0 || raceHeader.startLabel) && (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                  {raceHeader.metaParts.join(" · ")}
                </p>
                {raceHeader.startLabel ? (
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    Start {raceHeader.startLabel}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] gap-x-2 border-b border-border/50 bg-muted/40 px-2.5 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              #
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Horse
            </span>
            <span className="text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              SP
            </span>
          </div>
          {rows.map((row, index) => {
            const place = (index + 1) as SpFavouritePlace;
            const isFav = spFavouritePlace === place;
            return (
              <div
                key={place}
                className={cn(
                  "grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-2 border-b border-border/40 px-2.5 py-2 last:border-b-0",
                  index % 2 === 1 && "bg-muted/20"
                )}
              >
                <button
                  type="button"
                  title={
                    isFav
                      ? "SP favourite, click to clear"
                      : place === 1
                        ? "Mark winner as SP favourite"
                        : `Mark ${place} as SP favourite`
                  }
                  aria-pressed={isFav}
                  onClick={() =>
                    setSpFavouritePlace((prev) => (prev === place ? null : place))
                  }
                  className={cn(
                    "flex h-7 w-full items-center justify-start gap-0.5 rounded text-left text-sm font-bold tabular-nums transition-colors",
                    isFav
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-foreground hover:text-amber-700 dark:hover:text-amber-300"
                  )}
                >
                  <span>{place}.</span>
                  {isFav ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wide">
                      Fav
                    </span>
                  ) : null}
                </button>
                <div className="relative flex min-w-0 items-center gap-0.5">
                  <input
                    value={row.horse}
                    onChange={(e) => updateRow(index, { horse: e.target.value })}
                    placeholder={place === 1 ? "Winner" : "-"}
                    list={horseOptions.length > 0 ? runnersListId : undefined}
                    className={cn(ghostInputClass, "min-w-0 flex-1")}
                    autoComplete="off"
                    aria-label={`Horse for ${place}`}
                  />
                  {horseOptions.length > 0 ? (
                    <label className="relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center text-muted-foreground/70 hover:text-foreground">
                      <ChevronDown className="size-3.5" aria-hidden />
                      <select
                        aria-label={`Pick horse for ${place}`}
                        title="Pick from runners"
                        className="absolute inset-0 z-10 cursor-pointer opacity-0"
                        value={
                          horseOptions.some((n) => horseEquals(n, row.horse))
                            ? horseOptions.find((n) => horseEquals(n, row.horse))!
                            : ""
                        }
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next) updateRow(index, { horse: next });
                        }}
                      >
                        <option value="">Pick…</option>
                        {horseOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="flex min-w-0 items-baseline justify-end gap-1">
                  <input
                    value={row.spText}
                    onChange={(e) => updateRow(index, { spText: e.target.value })}
                    placeholder="-"
                    inputMode="decimal"
                    className={cn(
                      ghostInputClass,
                      "min-w-0 flex-1 text-right font-normal tabular-nums text-muted-foreground"
                    )}
                    autoComplete="off"
                    aria-label={`SP for ${place}`}
                  />
                  {isFav ? (
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Fav
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {horseOptions.length > 0 ? (
          <datalist id={runnersListId}>
            {horseOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        ) : null}

        <Button
          className="mt-1"
          disabled={!firstHorse || ocrBusy}
          onClick={() => {
            const places = rows
              .map((row, i) => {
                const position = (i + 1) as SpFavouritePlace;
                const spDecimal = parseSpInput(row.spText);
                const runner: PlacingsPayload["runners"][number] = {
                  horse: row.horse.trim(),
                  position,
                };
                if (spDecimal != null) runner.spDecimal = spDecimal;
                if (spFavouritePlace === position) runner.isSpFavourite = true;
                return runner;
              })
              .filter((r) => r.horse);
            onRecord({ winner: firstHorse, runners: places });
            setOpen(false);
          }}
        >
          Save result
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Success-token CTA for Set / Edit result triggers (pairs with "Tracked"). */
export const resultActionButtonClass =
  "border-success/40 bg-success/10 text-success hover:bg-success/15";

export function placingsTriggerLabel(
  event: EventRow,
  incomplete?: boolean
): string {
  const existing = parseRaceResults(event.goals);
  if (incomplete) return "Fix result";
  if (existing) return "Edit result";
  return "Set result";
}
