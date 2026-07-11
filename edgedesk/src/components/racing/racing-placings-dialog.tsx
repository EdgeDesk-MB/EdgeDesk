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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BetRow, EventRow } from "@/lib/db/schema";
import {
  isRaceResultIncomplete,
  parseRaceResults,
  parseRacecardRunners,
} from "@/lib/racing";
import { buildRacingResultsLinks } from "@/lib/racing/results-link";
import { parseRaceResultText } from "@/lib/racing/parse-race-result-text";
import { matchOcrToRunner } from "@/lib/ocr/match-runner";
import { ocrRaceResultScreenshot } from "@/lib/ocr/extract-text";
import { cn } from "@/lib/utils";
import { ClipboardPaste, ExternalLink, Loader2, ScanLine } from "lucide-react";

export type PlacingsPayload = {
  winner: string;
  runners: { horse: string; position: number }[];
};

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

  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");
  const [fourth, setFourth] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsLinks = buildRacingResultsLinks(event);

  function hydrate() {
    const byPos = (n: number) =>
      existing?.runners.find((r) => r.position === n)?.horse ?? "";
    const winner = byPos(1) || existing?.winner || "";
    setFirst(winner);
    let secondVal = byPos(2);
    if (
      !secondVal &&
      existing &&
      isRaceResultIncomplete(existing) &&
      selectionHints[0] &&
      !horseEquals(selectionHints[0], winner)
    ) {
      secondVal = selectionHints[0];
    }
    setSecond(secondVal);
    setThird(byPos(3));
    setFourth(byPos(4));
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
      setFirst(resolve(parsed.first));
      if (parsed.second) setSecond(resolve(parsed.second));
      if (parsed.third) setThird(resolve(parsed.third));
      if (parsed.fourth) setFourth(resolve(parsed.fourth));
      const filled = [parsed.first, parsed.second, parsed.third, parsed.fourth].filter(Boolean)
        .length;
      toast.success(
        filled === 1
          ? "Filled the winner - check the rest"
          : `Filled ${filled} placings - double-check before saving`
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Race placings</DialogTitle>
          <DialogDescription>
            Enter 1st–4th, or paste a result / screenshot. Place-refunds need finishing position.
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

        <div className="grid gap-3">
          {(
            [
              ["1st (winner)", first, setFirst],
              ["2nd", second, setSecond],
              ["3rd", third, setThird],
              ["4th", fourth, setFourth],
            ] as const
          ).map(([label, value, setValue]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={label === "1st (winner)" ? "e.g. Constitution Hill" : "optional"}
                list={`runners-${event.id}`}
              />
            </div>
          ))}
          {(cardRunners.length > 0 || selectionHints.length > 0) && (
            <datalist id={`runners-${event.id}`}>
              {[...new Set([...selectionHints, ...cardRunners])].map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </div>
        <Button
          className="mt-1"
          disabled={!first.trim() || ocrBusy}
          onClick={() => {
            const places = [first, second, third, fourth]
              .map((h, i) => ({ horse: h.trim(), position: i + 1 }))
              .filter((r) => r.horse);
            onRecord({ winner: first.trim(), runners: places });
            setOpen(false);
          }}
        >
          Save placings
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function placingsTriggerLabel(
  event: EventRow,
  incomplete?: boolean
): string {
  const existing = parseRaceResults(event.goals);
  if (incomplete) return "Fix placings";
  if (existing) return "Edit placings";
  return "Set placings";
}
