"use client";

/**
 * The burger menu, two shapes for two worlds:
 * - Desktop (sidebar visible): a compact utilities dropdown - Appearance,
 *   Settings, Release notes, Help.
 * - Mobile: a full-height drawer sliding in from the right, carrying the
 *   whole sectioned navigation plus the same utilities.
 * Both derive navigation from NAV_SECTIONS, so nothing can drift.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { BookOpen, ChevronRight, Menu, ScrollText, Settings, X } from "lucide-react";
import {
  ActionBadge,
  NAV_SECTIONS,
  flattenNavEntries,
  isLinkActive,
} from "@/components/app-nav";
import { EdgeDeskLogoIcon } from "@/components/edge-desk-logo-icon";
import { ThemeSelect } from "@/components/theme-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppState } from "@/hooks/use-app-state";
import { captionHeading } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * The sidebar hides below `md` (768px), so the drawer must take over at
 * exactly that width - useIsMobile gates at `sm` and would leave a 640-768px
 * band with no main navigation at all (design-review finding).
 */
function useBelowMd(): boolean | null {
  const [below, setBelow] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767.98px)");
    const update = () => setBelow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return below;
}

const utilityRow =
  "flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60";

const UTILITY_LINKS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/release-notes", label: "Release notes", icon: ScrollText },
  { href: "/help", label: "Help", icon: BookOpen },
] as const;

/**
 * Utility rows. In the desktop dropdown they must be DropdownMenuItems so
 * radix keyboard navigation reaches them; the drawer uses plain links.
 */
function UtilityLinks({
  asMenuItems = false,
  onNavigate,
}: {
  asMenuItems?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {UTILITY_LINKS.map(({ href, label, icon: Icon }) => {
        const link = (
          <Link
            key={href}
            href={href}
            className={cn(utilityRow, "border-t border-border/80")}
            onClick={onNavigate}
          >
            <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        );
        return asMenuItems ? (
          <DropdownMenuItem key={href} asChild className="rounded-none p-0">
            {link}
          </DropdownMenuItem>
        ) : (
          link
        );
      })}
    </>
  );
}

function AppearanceRow() {
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3.5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className={captionHeading}>Appearance</p>
      <ThemeSelect />
    </div>
  );
}

function BurgerButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="relative z-[45] flex size-8 shrink-0 items-center justify-center overflow-visible rounded-md bg-white text-topbar shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      aria-label="Open menu"
      {...props}
    >
      <Menu className="size-4 shrink-0" strokeWidth={2.25} />
    </button>
  );
}

/** Mobile: full-height drawer from the right with the sectioned navigation. */
function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { state } = useAppState();
  const alertsUnread = state?.alertsUnread ?? 0;
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <BurgerButton />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {/* Heavier, slower scrim than dialog.tsx on purpose - a full-height
            drawer replaces the page context, a dialog only floats over it. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(20rem,85vw)] flex-col border-l border-border/80 bg-popover text-popover-foreground shadow-xl duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-topbar">
                <EdgeDeskLogoIcon className="size-4 text-topbar-foreground" />
              </span>
              <DialogPrimitive.Title className="text-sm font-bold">
                EdgeDesk
              </DialogPrimitive.Title>
            </span>
            <DialogPrimitive.Close
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <nav
            aria-label="Main navigation"
            className="min-h-0 flex-1 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {NAV_SECTIONS.map((section) => (
              <div key={section.label ?? "top"}>
                {section.label ? (
                  <p className={cn(captionHeading, "px-4 pb-1 pt-4")}>{section.label}</p>
                ) : (
                  <div className="pt-2" />
                )}
                {flattenNavEntries(section.entries).map((item) => {
                  const active = isLinkActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-selection-subtle text-foreground"
                          : "text-foreground/90 hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.href === "/alerts" ? <ActionBadge count={alertsUnread} /> : null}
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="mt-4 border-t border-border/80">
              <AppearanceRow />
              <UtilityLinks onNavigate={close} />
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Desktop: the sidebar owns navigation, so the burger is utilities only. */
function DesktopUtilitiesMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BurgerButton />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="max-h-[min(38rem,85vh)] w-72 overflow-y-auto overflow-x-hidden rounded-lg border-2 border-primary/35 bg-popover p-0 shadow-xl ring-0"
      >
        <AppearanceRow />
        <UtilityLinks asMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppTopBarMenu() {
  // null on first paint - render the desktop shape until we know (the button
  // itself is identical, so there is no visual flicker either way). Gated at
  // md to hand over exactly where the sidebar disappears.
  const belowMd = useBelowMd();
  return belowMd === true ? <MobileNavDrawer /> : <DesktopUtilitiesMenu />;
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
