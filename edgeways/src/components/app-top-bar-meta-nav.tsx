"use client";

/**
 * AppTopBarMetaNav — meta-tab strip (all breakpoints).
 *
 * Selection chrome (pill + label colour) always follows the route
 * (`activeMetaNavId(pathname)`). Optimistic pending ids were sticky across
 * in-page links / abandoned presses and desynced the tab from the page.
 *
 * Pill motion: WAAPI slide on fine pointers; snap on coarse / reduced-motion.
 * Routes are prefetched; Links use the App Router normally (no hijacked push).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChromeTab } from "@/components/chrome-tab";
import { TopBarSessionButton } from "@/components/top-bar-login-button";
import { TOP_SUB_NAV_ITEMS, activeMetaNavId, type MetaNavItem } from "@/content/meta-nav";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import { META_TAB_DURATION_S, META_TAB_EASE } from "@/lib/ui/motion";
import { appShellMaxWidth } from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

const PILL_MS = Math.round(META_TAB_DURATION_S * 1000);
const PILL_EASING = `cubic-bezier(${META_TAB_EASE.join(",")})`;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prefersSnapPill(): boolean {
  return (
    prefersReducedMotion() ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function measureTab(
  nav: HTMLElement,
  tab: HTMLElement
): { left: number; width: number } | null {
  const rootRect = nav.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const width = Math.round(tabRect.width);
  if (width <= 0) return null;
  return {
    left: Math.round(tabRect.left - rootRect.left + nav.scrollLeft),
    width,
  };
}

function measureActive(nav: HTMLElement): { left: number; width: number } | null {
  const active = nav.querySelector('[aria-current="page"]') as HTMLElement | null;
  if (!active) return null;
  return measureTab(nav, active);
}

function applyPillBox(
  el: HTMLDivElement,
  box: { left: number; width: number }
) {
  el.style.transform = `translate3d(${box.left}px, 0, 0)`;
  el.style.width = `${box.width}px`;
}

function MetaNavTab({
  item,
  active,
}: {
  item: MetaNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      data-meta-nav={item.id}
      aria-current={active ? "page" : undefined}
      prefetch
      className={cn(
        "group/meta-tab relative z-[1] flex shrink-0 touch-manipulation items-center gap-1.5 px-2.5 pt-1.5 pb-2 text-[13px] font-semibold tracking-tight",
        "outline-none ring-0 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-0",
        active ? "text-foreground" : "text-topbar-muted"
      )}
    >
      {!active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -bottom-px z-0 opacity-0 transition-opacity duration-100 group-hover/meta-tab:opacity-10 group-focus-visible/meta-tab:opacity-10 group-active/meta-tab:opacity-[0.14]"
        >
          <ChromeTab edge="rise" className="absolute inset-0" />
        </span>
      ) : null}
      <Icon
        className="relative z-[1] size-3.5 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="relative z-[1]">{item.label}</span>
    </Link>
  );
}

export function AppTopBarMetaNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = activeMetaNavId(pathname);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef({ left: 0, width: 0 });
  const placedRef = useRef(false);
  const animRef = useRef<Animation | null>(null);
  const [pillReady, setPillReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useDragToScroll(scrollRef);

  // Warm meta + desk routes so flip/phone tab switches aren’t cold compiles.
  useEffect(() => {
    for (const item of TOP_SUB_NAV_ITEMS) {
      void router.prefetch(item.href);
    }
  }, [router]);

  // Mount the pill once we can measure the route’s active tab.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || pillReady) return;
    const next = measureActive(nav);
    if (!next) return;
    boxRef.current = next;
    setPillReady(true);
  }, [activeId, pillReady]);

  useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el || !pillReady) return;
    applyPillBox(el, boxRef.current);
    placedRef.current = true;
  }, [pillReady]);

  // Pill always tracks the route — sole source of truth.
  useLayoutEffect(() => {
    if (!placedRef.current) return;
    const nav = navRef.current;
    const el = pillRef.current;
    if (!nav || !el) return;
    const next = measureActive(nav);
    if (!next) return;
    const from = boxRef.current;
    if (from.left === next.left && from.width === next.width) return;

    animRef.current?.cancel();
    boxRef.current = next;

    if (prefersSnapPill()) {
      applyPillBox(el, next);
      return;
    }

    const anim = el.animate(
      [
        {
          transform: `translate3d(${from.left}px, 0, 0)`,
          width: `${from.width}px`,
        },
        {
          transform: `translate3d(${next.left}px, 0, 0)`,
          width: `${next.width}px`,
        },
      ],
      {
        duration: PILL_MS,
        easing: PILL_EASING,
        fill: "forwards",
      }
    );
    animRef.current = anim;
    anim.onfinish = () => {
      applyPillBox(el, next);
      animRef.current = null;
    };
  }, [activeId, pathname]);

  // Re-snap on resize (no animation). Ignore no-op size changes — mobile URL
  // bar show/hide fires resize constantly.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onResize = () => {
      const next = measureActive(nav);
      const el = pillRef.current;
      if (!next || !el) return;
      const prev = boxRef.current;
      if (prev.left === next.left && prev.width === next.width) return;
      animRef.current?.cancel();
      boxRef.current = next;
      applyPillBox(el, next);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(nav);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Keep the active tab in the horizontal strip.
  useEffect(() => {
    const nav = navRef.current;
    const scroller = nav?.parentElement;
    if (!nav || !scroller) return;
    const active = nav.querySelector('[aria-current="page"]') as HTMLElement | null;
    if (!active) return;
    const sRect = scroller.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const pad = 8;
    if (aRect.left < sRect.left + pad) {
      scroller.scrollLeft += aRect.left - sRect.left - pad;
    } else if (aRect.right > sRect.right - pad) {
      scroller.scrollLeft += aRect.right - sRect.right + pad;
    }
  }, [activeId]);

  return (
    <div className="relative overflow-visible">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 hidden h-px bg-topbar-border sm:block"
        aria-hidden
      />

      <div
        className={cn(
          "relative z-[1] w-full overflow-visible px-0 sm:pl-[calc(var(--layout-page-x)-8px)] sm:pr-[var(--layout-page-x)]",
          appShellMaxWidth
        )}
      >
        <div className="flex min-w-0 items-end gap-0.5">
          {/*
            overflow-x + overflow-y:visible computes y to auto — a nested
            scrollport that eats taps on iOS. Use clip (not visible) on y.
            No edge fades on the submenu. Mouse drag-to-pan; touch keeps native scroll.
          */}
          <div
            ref={scrollRef}
            className="app-scroll-overlay min-w-0 flex-1 overscroll-x-contain overflow-x-auto overflow-y-clip"
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerEnter={drag.onPointerEnter}
            onPointerLeave={drag.onPointerLeave}
            onPointerCancel={drag.onPointerCancel}
            onClickCapture={drag.onClickCapture}
          >
            <nav
              ref={navRef}
              aria-label="Site sections"
              className="relative flex w-max min-w-full items-end gap-0.5 pl-1 pr-[var(--chrome-tab-r)] sm:px-[var(--chrome-tab-r)]"
            >
              {pillReady ? (
                <div
                  ref={pillRef}
                  aria-hidden
                  className="pointer-events-none absolute top-0 -bottom-px left-0 z-0 will-change-transform"
                >
                  <ChromeTab edge="rise" className="absolute inset-0" />
                </div>
              ) : null}

              {TOP_SUB_NAV_ITEMS.map((item) => (
                <MetaNavTab
                  key={item.id}
                  item={item}
                  active={item.id === activeId}
                />
              ))}
            </nav>
          </div>
          <div className="hidden shrink-0 items-end pr-8 md:flex">
            <TopBarSessionButton />
          </div>
        </div>
      </div>
    </div>
  );
}
