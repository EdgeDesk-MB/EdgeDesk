"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges"

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
          "box-border h-auto w-fit gap-0.5 rounded-full bg-muted/60 p-0.5",
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

function TabsList({
  className,
  variant = "default",
  /** Scroll-fade gradient source for variant="line" - match the surface the tab strip sits on. */
  fadeClassName = "from-card",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & { fadeClassName?: string }) {
  const list = (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        tabsListVariants({ variant }),
        variant === "line" && "w-max",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  )

  // Underline tab strips can outgrow their container (Settings, fixture
  // filters, ...) - scroll horizontally with a fade cue instead of wrapping
  // or clipping, and never show a scrollbar (line tabs read as app chrome).
  // The leading/trailing space is padding on the scrollable content itself
  // (matching gap-6, the same as the inter-tab gap) rather than an outer
  // margin, so it scrolls away and fades like any other tab.
  if (variant === "line") {
    return (
      <ScrollFadeEdges
        orientation="horizontal"
        dragToScroll
        className="w-full flex-none"
        scrollClassName="app-scroll-overlay overflow-x-auto pl-6 pr-6"
        fadeClassName={fadeClassName}
      >
        {list}
      </ScrollFadeEdges>
    )
  }

  return list
}

const segmentedTrigger =
  "group-data-[variant=segmented]/tabs-list:h-8 group-data-[variant=segmented]/tabs-list:min-h-8 group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:items-center group-data-[variant=segmented]/tabs-list:justify-center group-data-[variant=segmented]/tabs-list:gap-1.5 group-data-[variant=segmented]/tabs-list:rounded-full group-data-[variant=segmented]/tabs-list:border-0 group-data-[variant=segmented]/tabs-list:bg-transparent group-data-[variant=segmented]/tabs-list:px-3 group-data-[variant=segmented]/tabs-list:py-0 group-data-[variant=segmented]/tabs-list:text-xs group-data-[variant=segmented]/tabs-list:font-semibold group-data-[variant=segmented]/tabs-list:leading-none group-data-[variant=segmented]/tabs-list:text-muted-foreground group-data-[variant=segmented]/tabs-list:shadow-none group-data-[variant=segmented]/tabs-list:transition-[color,background-color,box-shadow] group-data-[variant=segmented]/tabs-list:duration-200 group-data-[variant=segmented]/tabs-list:hover:bg-transparent group-data-[variant=segmented]/tabs-list:hover:text-foreground group-data-[variant=segmented]/tabs-list:active:bg-transparent group-data-[variant=segmented]/tabs-list:data-active:bg-chip group-data-[variant=segmented]/tabs-list:data-active:font-bold group-data-[variant=segmented]/tabs-list:data-active:text-chip-foreground group-data-[variant=segmented]/tabs-list:data-active:shadow-sm group-data-[variant=segmented]/tabs-list:data-active:hover:bg-chip group-data-[variant=segmented]/tabs-list:data-active:active:bg-chip group-data-[variant=segmented]/tabs-list:[&_svg:not([class*='size-'])]:size-3.5"

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group/tab-trigger relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:pb-2.5 group-data-[variant=line]/tabs-list:pt-0 group-data-[variant=line]/tabs-list:font-semibold group-data-[variant=line]/tabs-list:shadow-none group-data-[variant=line]/tabs-list:hover:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:text-foreground group-data-[variant=line]/tabs-list:data-active:shadow-none dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        segmentedTrigger,
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground dark:group-data-[variant=default]/tabs-list:data-active:border-input dark:group-data-[variant=default]/tabs-list:data-active:bg-input/30 dark:group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=segmented]/tabs-list:data-active:text-chip-foreground",
        "after:absolute after:bg-highlight after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:h-0.5 group-data-[variant=default]/tabs-list:after:bottom-[-5px] group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:z-[1] group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
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
 * TabsList owns its own leading/trailing space (see TabsList) so that space
 * lives inside the scrollable region and fades correctly, instead of sitting
 * outside it as a fixed gap.
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
        "w-full border-b border-border/60",
        bleed === "card" && "-mx-(--card-spacing)",
        bleed === "dialog" && "-mx-6",
        className
      )}
      {...props}
    />
  )
}
