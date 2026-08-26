"use client";

import type { ReactNode } from "react";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { deskRunDialogBodyClass } from "@/lib/ui/desk-run-dialog";

/** Scroll region for Acca / Bet Builder / Systems create-run dialogs. */
export function DeskRunDialogBody({ children }: { children: ReactNode }) {
  return (
    <ScrollFadeEdges
      className="min-h-0 flex-1"
      fadeClassName="from-page dark:from-card"
      scrollClassName={deskRunDialogBodyClass}
    >
      {children}
    </ScrollFadeEdges>
  );
}
