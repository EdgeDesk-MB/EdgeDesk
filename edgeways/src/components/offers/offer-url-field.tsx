"use client";

/**
 * Link-to-offer URL field with in-field Paste / Clear / Open actions.
 */

import { useState, type ReactNode } from "react";
import { ClipboardPaste, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  extractOfferUrlCandidate,
  normalizeOfferUrl,
} from "@/lib/offers/offer-url";
import { cn } from "@/lib/utils";

function FieldIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export function OfferUrlField({
  id,
  value,
  onChange,
  label = "Link to offer",
  labelClassName,
  gapClassName = "gap-1",
  "aria-invalid": ariaInvalid,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  labelClassName?: string;
  /** Tailwind gap between label and field (sports uses gap-1, casino gap-1.5). */
  gapClassName?: string;
  "aria-invalid"?: boolean;
  error?: string | null;
}) {
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const normalized = normalizeOfferUrl(value);
  const hasValue = value.trim().length > 0;
  const trailingCount = 1 + (hasValue ? 1 : 0) + (normalized ? 1 : 0);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const next = extractOfferUrlCandidate(text);
      if (!next) {
        setPasteHint("Clipboard is empty");
        return;
      }
      onChange(next);
      setPasteHint(null);
    } catch {
      setPasteHint("Could not read clipboard. Paste with ⌘V instead.");
    }
  }

  function openUrl() {
    if (!normalized) return;
    window.open(normalized, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("flex flex-col", gapClassName)}>
      <Label
        htmlFor={id}
        className={cn("text-xs text-muted-foreground", labelClassName)}
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://…"
          value={value}
          aria-invalid={ariaInvalid}
          onChange={(e) => {
            onChange(e.target.value);
            if (pasteHint) setPasteHint(null);
          }}
          className={cn(
            trailingCount === 1 && "pr-9",
            trailingCount === 2 && "pr-[4.25rem]",
            trailingCount >= 3 && "pr-[6.25rem]"
          )}
        />
        <div className="absolute inset-y-0 right-0.5 flex items-center gap-0.5">
          {normalized ? (
            <FieldIconButton label="Open offer link" onClick={openUrl}>
              <ExternalLink className="size-3.5" />
            </FieldIconButton>
          ) : null}
          {hasValue ? (
            <FieldIconButton
              label="Clear link"
              onClick={() => {
                onChange("");
                setPasteHint(null);
              }}
            >
              <X className="size-3.5" />
            </FieldIconButton>
          ) : null}
          <FieldIconButton
            label="Paste link"
            onClick={() => void pasteFromClipboard()}
          >
            <ClipboardPaste className="size-3.5" />
          </FieldIconButton>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : pasteHint ? (
        <p className="text-xs text-muted-foreground">{pasteHint}</p>
      ) : null}
    </div>
  );
}
