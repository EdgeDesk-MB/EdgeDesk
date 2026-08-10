"use client";

import type { ReactNode } from "react";
import type { PasteProvenance } from "@/lib/offers/merge-paste-draft";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/** Success tint when a field was filled from paste and not yet edited. */
export function pasteFieldClass(
  provenance: PasteProvenance | undefined,
  opts?: { requiredEmpty?: boolean; className?: string }
): string {
  return cn(
    opts?.requiredEmpty && "ring-2 ring-black dark:ring-white",
    provenance === "paste" && "border-success/40 bg-success/5",
    opts?.className
  );
}

export function PasteFieldLabel({
  children,
  provenance,
  required,
  htmlFor,
  describedById,
}: {
  children: ReactNode;
  provenance?: PasteProvenance;
  required?: boolean;
  htmlFor?: string;
  /** When set, pairs with aria-describedby on the control */
  describedById?: string;
}) {
  const pasteId = describedById ?? (htmlFor ? `${htmlFor}-paste` : undefined);
  return (
    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {children}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {provenance === "paste" ? (
        <span
          id={pasteId}
          className="inline-flex text-success"
          title="Filled from paste"
          aria-label="Filled from paste"
        >
          <Check className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

export function pasteDescribedBy(
  provenance: PasteProvenance | undefined,
  controlId: string
): string | undefined {
  return provenance === "paste" ? `${controlId}-paste` : undefined;
}
