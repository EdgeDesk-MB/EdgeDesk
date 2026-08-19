"use client";

/**
 * Mobile burger drawer — desk section nav + meta links + appearance.
 * Meta pages also sit in the shared top-bar strip (`AppTopBarMetaNav`).
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronRight, Menu, X } from "lucide-react";
import {
  ActionBadge,
  EdgeRaceNavMark,
  NAV_SECTIONS,
  NavSectionLabel,
  PlanNavMark,
  flattenNavEntries,
  isLinkActive,
  toastPlanLock,
} from "@/components/app-nav";
import { canWithPreview } from "@/lib/entitlements/plans";
import { ThemeSelect } from "@/components/theme-select";
import { MobileDrawerSessionButton } from "@/components/top-bar-login-button";
import { useAppState } from "@/hooks/use-app-state";
import {
  useOfferEdgeRaceCount,
  useRacingOfferEdgeKey,
} from "@/hooks/use-offer-edge-race-count";
import { isEventPendingSettle } from "@/lib/racing/pending-settle";
import { META_NAV_ITEMS } from "@/content/meta-nav";
import { captionHeading, drawerUtilityRow } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function UtilityLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {META_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(drawerUtilityRow, "border-t border-border/80")}
          onClick={onNavigate}
        >
          <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="flex-1">{label}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
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
      className="topbar-accent-face skeuo-solid relative z-[45] flex size-9 shrink-0 items-center justify-center overflow-visible rounded-[var(--radius-button)] border border-transparent bg-topbar-accent text-topbar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/30"
      aria-label="Open menu"
      {...props}
    >
      <Menu className="size-[18px] shrink-0" strokeWidth={2.25} />
    </button>
  );
}

/** Mobile: full-height drawer from the right with the sectioned navigation. */
function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { state } = useAppState();
  const alertsUnread = state?.alertsUnread ?? 0;
  const openBetCount = (state?.bets ?? []).filter((b) => b.status === "open").length;
  const boostsOpen = state?.boostsOpen ?? 0;
  const casinoNeedsAction = state?.casinoNeedsAction ?? 0;
  const accaLayDue = state?.accaLayDue?.length ?? 0;
  const betBuilderLayDue = state?.betBuilderLayDue?.length ?? 0;
  const racingPendingSettle = (state?.events ?? []).filter((e) =>
    isEventPendingSettle(e)
  ).length;
  const racingOfferKey = useRacingOfferEdgeKey(state?.offers);
  const edgeRaceCount = useOfferEdgeRaceCount(state?.settings, racingOfferKey);
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
          <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border/80 px-4 py-3">
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
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
                  <NavSectionLabel
                    label={section.label}
                    pro={section.pro}
                    className="px-4 pb-1 pt-4"
                  />
                ) : (
                  <div className="pt-2" />
                )}
                {flattenNavEntries(section.entries).map((item) => {
                  const active = isLinkActive(pathname, item.href);
                  const locked = Boolean(
                    item.feature && !canWithPreview(state?.settings, item.feature)
                  );
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-disabled={locked || undefined}
                      onClick={(e) => {
                        if (locked && item.feature) {
                          e.preventDefault();
                          toastPlanLock(item.feature);
                          return;
                        }
                        close();
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-selection-subtle text-foreground"
                          : "text-foreground/90 hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="size-4.5 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate">{item.label}</span>
                        {item.feature ? (
                          <PlanNavMark feature={item.feature} locked={locked} />
                        ) : null}
                        {!locked && item.href === "/tracker" ? (
                          <ActionBadge count={openBetCount} />
                        ) : null}
                        {!locked && item.href === "/boosts" ? (
                          <ActionBadge count={boostsOpen} />
                        ) : null}
                        {item.href === "/alerts" ? <ActionBadge count={alertsUnread} /> : null}
                        {item.href === "/casino" ? (
                          <ActionBadge count={casinoNeedsAction} />
                        ) : null}
                        {!locked && item.href === "/acca" ? (
                          <ActionBadge count={accaLayDue} />
                        ) : null}
                        {!locked && item.href === "/bet-builder" ? (
                          <ActionBadge count={betBuilderLayDue} />
                        ) : null}
                        {item.href === "/racing" ? (
                          <>
                            <EdgeRaceNavMark count={edgeRaceCount} />
                            <ActionBadge count={racingPendingSettle} />
                          </>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="mt-4 border-t border-border/80">
              <AppearanceRow />
              <UtilityLinks onNavigate={close} />
              <MobileDrawerSessionButton onNavigate={close} />
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function AppTopBarMenu() {
  return <MobileNavDrawer />;
}

/** Desk-style square icon button on the dark top bar */
export function TopBarButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 shrink-0 items-center justify-center rounded-lg bg-topbar-accent text-topbar-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/30",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
