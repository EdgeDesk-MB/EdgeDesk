"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges"
import { useSlidingIndicator } from "@/hooks/use-sliding-indicator"
import { springTransition } from "@/lib/ui/motion"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "h-auto gap-6 rounded-none border-0 bg-transparent p-0",
        segmented: cn(
          // Override base `group-data-horizontal/tabs:h-8` or py is crushed to 0.
          "box-border h-auto w-fit gap-0.5 group-data-horizontal/tabs:h-auto bg-muted/60",
          "rounded-[var(--segmented-radius)]",
          "px-[var(--segmented-track-pad-x)] py-[var(--segmented-track-pad)]",
          "ring-1 ring-border/35",
          "dark:bg-input/30 dark:ring-border/50"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/**
 * Horizontal tab strips scroll with drag-to-pan + edge fades when they
 * overflow; no scrollbar. When every tab fits, overflow is inert (no fade).
 */
function TabsScrollList({
  className,
  variant = "default",
  fadeClassName = "from-card",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & { fadeClassName?: string }) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const isLine = variant === "line"
  const indicator = useSlidingIndicator(
    listRef,
    '[data-slot="tabs-trigger"][data-state="active"], [data-slot="tabs-trigger"][data-active]'
  )

  const isSegmented = variant === "segmented"

  return (
    <ScrollFadeEdges
      orientation="horizontal"
      dragToScroll
      className={cn(
        "w-full flex-none",
        isSegmented && "rounded-[var(--segmented-radius)]"
      )}
      scrollClassName={cn(
        "app-scroll-overlay overflow-x-auto",
        // Match card content inset when TabsLineBar bleeds; Racing Desk
        // (no bleed, px-0 CardContent) also lands on --card-spacing.
        isLine ? "px-(--card-spacing)" : undefined,
        isSegmented && "rounded-[var(--segmented-radius)]"
      )}
      fadeClassName={fadeClassName}
    >
      <TabsPrimitive.List
        ref={listRef}
        data-slot="tabs-list"
        data-variant={variant ?? "default"}
        className={cn(
          tabsListVariants({ variant }),
          // w-max grows with tabs; min-w-full keeps few segmented tabs stretched.
          "relative w-max min-w-full",
          // Beat base `rounded-lg` / fixed h-8 from the shared list recipe.
          isSegmented && "h-auto rounded-full group-data-horizontal/tabs:h-auto",
          className
        )}
        {...props}
      >
        {isLine && indicator.ready ? (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 z-[1] h-0.5 bg-highlight motion-reduce:transition-none"
            style={{
              left: indicator.left,
              width: indicator.width,
              transition: `left ${springTransition}, width ${springTransition}`,
            }}
          />
        ) : null}
        {children}
      </TabsPrimitive.List>
    </ScrollFadeEdges>
  )
}

function TabsList({
  className,
  variant = "default",
  /** Scroll-fade gradient source — match the surface the tab strip sits on. */
  fadeClassName = "from-card",
  orientation,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    fadeClassName?: string
    orientation?: "horizontal" | "vertical"
  }) {
  // Vertical lists never overflow horizontally — keep the plain Radix list.
  if (orientation === "vertical") {
    return (
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant ?? "default"}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    )
  }

  return (
    <TabsScrollList
      className={className}
      variant={variant}
      fadeClassName={fadeClassName}
      {...props}
    >
      {children}
    </TabsScrollList>
  )
}

const segmentedTrigger = cn(
  "group-data-[variant=segmented]/tabs-list:h-8 group-data-[variant=segmented]/tabs-list:min-h-8 group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:items-center group-data-[variant=segmented]/tabs-list:justify-center group-data-[variant=segmented]/tabs-list:gap-1.5 group-data-[variant=segmented]/tabs-list:rounded-full group-data-[variant=segmented]/tabs-list:border-0 group-data-[variant=segmented]/tabs-list:bg-transparent group-data-[variant=segmented]/tabs-list:px-3 group-data-[variant=segmented]/tabs-list:py-0 group-data-[variant=segmented]/tabs-list:text-xs group-data-[variant=segmented]/tabs-list:font-semibold group-data-[variant=segmented]/tabs-list:leading-none group-data-[variant=segmented]/tabs-list:text-muted-foreground group-data-[variant=segmented]/tabs-list:shadow-none group-data-[variant=segmented]/tabs-list:transition-[color,background-color,box-shadow] group-data-[variant=segmented]/tabs-list:duration-200 group-data-[variant=segmented]/tabs-list:hover:bg-transparent group-data-[variant=segmented]/tabs-list:hover:text-foreground group-data-[variant=segmented]/tabs-list:active:bg-transparent group-data-[variant=segmented]/tabs-list:[&_svg:not([class*='size-'])]:size-3.5",
  /* Active solid brand plate — same filled-accent recipe as FilterPill */
  "group-data-[variant=segmented]/tabs-list:data-active:bg-brand group-data-[variant=segmented]/tabs-list:data-active:font-semibold group-data-[variant=segmented]/tabs-list:data-active:text-brand-foreground group-data-[variant=segmented]/tabs-list:data-active:shadow-[var(--ew-chip-shadow)] group-data-[variant=segmented]/tabs-list:data-active:hover:bg-brand group-data-[variant=segmented]/tabs-list:data-active:hover:text-brand-foreground group-data-[variant=segmented]/tabs-list:data-active:active:bg-brand group-data-[variant=segmented]/tabs-list:data-active:active:text-brand-foreground group-data-[variant=segmented]/tabs-list:data-active:focus-visible:text-brand-foreground group-data-[variant=segmented]/tabs-list:data-active:[&_svg]:text-brand-foreground",
  /* Inset focus ring — offset rings balloon the active pill inside the track */
  "group-data-[variant=segmented]/tabs-list:focus-visible:border-transparent group-data-[variant=segmented]/tabs-list:focus-visible:outline-none group-data-[variant=segmented]/tabs-list:focus-visible:ring-2 group-data-[variant=segmented]/tabs-list:focus-visible:ring-inset group-data-[variant=segmented]/tabs-list:focus-visible:ring-brand/60 group-data-[variant=segmented]/tabs-list:focus-visible:ring-offset-0"
)

/** Press longer than this is hold/scroll intent — do not select the tab. */
const TAB_HOLD_MS = 200
/** Pointer movement (px) before a press is treated as a drag, not a click. */
const TAB_DRAG_EPS = 4

/**
 * Radix selects on mousedown. We defer to a clean click so click-and-hold
 * (scroll intent) and drag-to-pan never change the active tab. App-wide.
 */
function TabsTrigger({
  className,
  onMouseDown,
  onClick,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const downRef = React.useRef<{ t: number; x: number; y: number } | null>(null)
  const cancelRef = React.useRef(false)
  const commitRef = React.useRef(false)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab-trigger relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:data-active:shadow-[var(--shadow-skeuo)] group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:pb-2.5 group-data-[variant=line]/tabs-list:pt-0 group-data-[variant=line]/tabs-list:font-semibold group-data-[variant=line]/tabs-list:shadow-none group-data-[variant=line]/tabs-list:hover:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:text-foreground group-data-[variant=line]/tabs-list:data-active:shadow-none dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        segmentedTrigger,
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground dark:group-data-[variant=default]/tabs-list:data-active:border-input dark:group-data-[variant=default]/tabs-list:data-active:bg-input/30 dark:group-data-[variant=default]/tabs-list:data-active:text-foreground",
        // Line tabs use a shared sliding spring underline on TabsList — hide per-trigger after.
        "after:absolute after:bg-highlight after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:h-0.5 group-data-[variant=default]/tabs-list:after:bottom-[-5px] group-data-[variant=line]/tabs-list:after:hidden group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5",
        className
      )}
      {...props}
      onMouseDown={(e) => {
        onMouseDown?.(e)
        // Allow one synthetic mousedown through so Radix can commit a clean click.
        if (commitRef.current) return
        // Block Radix select-on-press; hold/drag must not change the tab.
        if (e.button === 0 && !e.ctrlKey) {
          e.preventDefault()
          downRef.current = { t: performance.now(), x: e.clientX, y: e.clientY }
          cancelRef.current = false
        }
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e)
        const down = downRef.current
        if (!down || cancelRef.current) return
        if (
          Math.abs(e.clientX - down.x) > TAB_DRAG_EPS ||
          Math.abs(e.clientY - down.y) > TAB_DRAG_EPS
        ) {
          cancelRef.current = true
        }
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e)
        const down = downRef.current
        if (down && performance.now() - down.t >= TAB_HOLD_MS) {
          cancelRef.current = true
        }
        downRef.current = null
      }}
      onPointerCancel={(e) => {
        onPointerCancel?.(e)
        cancelRef.current = true
        downRef.current = null
      }}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (cancelRef.current) {
          cancelRef.current = false
          e.preventDefault()
          e.stopPropagation()
          return
        }
        // Clean click — re-enter Radix's mousedown selection path.
        // Do not focus() here: programmatic focus after click makes segmented
        // pills look oversized (focus ring) and confuses keyboard tab order.
        commitRef.current = true
        e.currentTarget.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            view: window,
          })
        )
        commitRef.current = false
      }}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

/**
 * Full-width bottom rule for underline tab rows - active indicator sits on
 * this line. Bleeds to the true edge with no re-added inset: the line-variant
 * TabsList owns leading/trailing space via `px-(--card-spacing)` so that
 * space lives inside the scrollable region and fades correctly.
 */
export function TabsLineBar({
  className,
  bleed,
  ...props
}: React.ComponentProps<"div"> & { bleed?: "card" | "dialog" }) {
  return (
    <div
      data-slot="tabs-line-bar"
      className={cn(
        "border-b border-border/60",
        // Negative margins alone do not widen a w-full box - the right edge
        // stays short by 2× the bleed. Expand width explicitly so the hairline
        // reaches both module edges.
        bleed === "card"
          ? "-mx-(--card-spacing) w-[calc(100%+2*var(--card-spacing))]"
          : bleed === "dialog"
            ? "-mx-6 w-[calc(100%+3rem)]"
            : "w-full",
        className
      )}
      {...props}
    />
  )
}
