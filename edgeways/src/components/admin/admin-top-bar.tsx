"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { TopBarSessionButton } from "@/components/top-bar-login-button";
import { ADMIN_NAV, isAdminNavActive } from "@/lib/admin/nav";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellMaxWidth,
} from "@/lib/ui/app-shell-layout";
import { adminModeTag } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function AdminTopBar() {
  const pathname = usePathname() ?? "";

  return (
    <header className="relative z-[45] shrink-0 overflow-visible bg-[#111111] text-topbar-foreground">
      <div className="bg-topbar">
        <div
          className="h-[var(--topbar-stripe-h)] w-full bg-highlight dark:bg-topbar-stripe md:bg-topbar-stripe"
          aria-hidden
        />
        <div
          className={cn(
            "flex h-14 w-full items-stretch overflow-visible",
            appShellGap,
            "px-0 pb-1 sm:px-[var(--layout-page-x)]",
            appShellMaxWidth
          )}
        >
          <Link
            href="/admin"
            aria-label="Admin home"
            className={cn(
              "flex shrink-0 items-center gap-2 self-center transition-opacity sm:hover:opacity-90",
              appNavInset,
              "md:hidden"
            )}
          >
            <EdgewaysLogo topbar />
            <span className="inline-flex origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-brand-logo px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-topbar-accent-foreground dark:bg-brand-on-topbar dark:text-brand">
              Beta
            </span>
          </Link>
          <div className={cn("hidden self-center md:block", appNavColumn)}>
            <Link
              href="/admin"
              aria-label="Admin home"
              className={cn(
                "flex shrink-0 items-center gap-2 transition-opacity sm:hover:opacity-90",
                appNavInset
              )}
            >
              <EdgewaysLogo topbar />
              <span className="inline-flex origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-brand-logo px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-topbar-accent-foreground dark:bg-brand-on-topbar dark:text-brand">
                Beta
              </span>
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pr-3 sm:pr-8">
            <span className={cn(adminModeTag, "shrink-0")}>ADMIN</span>
            <TopBarSessionButton />
          </div>
        </div>
        <ScrollFadeEdges
          orientation="horizontal"
          dragToScroll
          className={cn("md:hidden", appShellMaxWidth)}
          fadeClassName="from-topbar"
          scrollClassName="flex gap-0.5 overflow-x-auto px-2 pb-1"
        >
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isAdminNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-topbar-foreground/10 text-topbar-foreground"
                    : "text-topbar-muted hover:text-topbar-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </ScrollFadeEdges>
      </div>
    </header>
  );
}
