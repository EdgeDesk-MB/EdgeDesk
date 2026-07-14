"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { BookOpen, ChevronRight, Menu, Moon, ScrollText, Settings } from "lucide-react";
import { flatNavLinks } from "@/components/app-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function AppTopBarMenu() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative z-[45] flex size-8 shrink-0 items-center justify-center overflow-visible rounded-md bg-white text-topbar shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Open menu"
        >
          <Menu className="size-4 shrink-0" strokeWidth={2.25} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="max-h-[min(38rem,85vh)] w-72 overflow-y-auto overflow-x-hidden rounded-lg border-2 border-primary/35 bg-popover p-0 shadow-xl ring-0"
      >
        <Link
          href="/help"
          className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60"
        >
          <BookOpen className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="flex-1">Help</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/release-notes"
          className="flex items-center gap-3 border-t border-border/80 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60"
        >
          <ScrollText className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="flex-1">Release notes</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        {/* Main navigation - the sidebar is hidden below md, so it lives here. */}
        <nav aria-label="Main navigation" className="md:hidden">
          {flatNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 border-t border-border/80 px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-muted/60"
            >
              <item.icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>
        <Link
          href="/settings"
          className="flex items-center gap-3 border-t border-border/80 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60"
        >
          <Settings className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="flex-1">Settings</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <div
          className="flex items-center justify-between gap-3 border-t border-border/80 px-4 py-3.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <Moon className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
            <span className="text-sm font-bold">Dark mode</span>
          </div>
          <Switch
            checked={dark}
            disabled={!mounted}
            aria-label="Toggle dark mode"
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Flashscore-style square icon button on the dark top bar */
export function TopBarButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 shrink-0 items-center justify-center rounded-lg bg-topbar-accent text-topbar-foreground transition-colors hover:bg-topbar-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
