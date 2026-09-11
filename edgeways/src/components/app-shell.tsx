"use client";

/**
 * Main content row under the top bar. Desk routes get the side nav; meta
 * shell routes (`isMetaPath` — Settings, Support, Guides, Roadmap, …) omit
 * it entirely so the page panel is full width and AppNav never mounts.
 */

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { BetaFeedbackPrompt } from "@/components/feedback/beta-feedback-prompt";
import { isMetaPath } from "@/content/meta-nav";
import {
  appNavColumn,
  appShellGap,
  appShellMaxWidth,
  appShellPadding,
} from "@/lib/ui/app-shell-layout";
import { pagePanel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = isMetaPath(pathname);

  return (
    <div className="app-scroll min-h-0 flex-1 overflow-x-clip overflow-y-auto">
      <div
        className={cn(
          "flex w-full items-stretch",
          appShellPadding,
          appShellGap,
          appShellMaxWidth
        )}
      >
        {meta ? null : (
          <aside
            className={cn(
              "sticky top-[var(--layout-page-x)] hidden h-fit shrink-0 flex-col self-start pt-4 md:flex",
              appNavColumn
            )}
          >
            <AppNav />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col p-0 sm:p-1">
          <BetaFeedbackPrompt />
          <main
            className={cn(
              pagePanel,
              "flex w-full flex-col",
              "max-sm:rounded-none max-sm:shadow-none"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
