"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

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
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        segmented: cn(
          "box-border h-auto w-full gap-0 rounded-[var(--segmented-radius)] bg-muted/80 p-[var(--segmented-track-pad)]",
          "shadow-[inset_0_1px_2px_rgb(0_0_0/0.07)]",
          "ring-1 ring-border/45",
          "dark:bg-muted/35 dark:shadow-[inset_0_1px_3px_rgb(0_0_0/0.35)] dark:ring-border/60"
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
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

const segmentedTrigger =
  "group-data-[variant=segmented]/tabs-list:h-8 group-data-[variant=segmented]/tabs-list:min-h-8 group-data-[variant=segmented]/tabs-list:max-h-8 group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:items-center group-data-[variant=segmented]/tabs-list:justify-center group-data-[variant=segmented]/tabs-list:gap-1.5 group-data-[variant=segmented]/tabs-list:rounded-none group-data-[variant=segmented]/tabs-list:border-0 group-data-[variant=segmented]/tabs-list:px-3 group-data-[variant=segmented]/tabs-list:py-0 group-data-[variant=segmented]/tabs-list:text-xs group-data-[variant=segmented]/tabs-list:font-semibold group-data-[variant=segmented]/tabs-list:leading-none group-data-[variant=segmented]/tabs-list:text-muted-foreground group-data-[variant=segmented]/tabs-list:shadow-none group-data-[variant=segmented]/tabs-list:hover:bg-foreground/[0.04] group-data-[variant=segmented]/tabs-list:hover:text-foreground/80 group-data-[variant=segmented]/tabs-list:active:bg-foreground/[0.07] group-data-[variant=segmented]/tabs-list:data-active:bg-card group-data-[variant=segmented]/tabs-list:data-active:text-foreground group-data-[variant=segmented]/tabs-list:data-active:hover:bg-card group-data-[variant=segmented]/tabs-list:data-active:active:bg-card group-data-[variant=segmented]/tabs-list:first:data-active:rounded-[var(--segmented-radius)_var(--radius-sm)_var(--radius-sm)_var(--segmented-radius)] group-data-[variant=segmented]/tabs-list:last:data-active:rounded-[var(--radius-sm)_var(--segmented-radius)_var(--segmented-radius)_var(--radius-sm)] group-data-[variant=segmented]/tabs-list:data-active:only:rounded-[var(--segmented-radius)] group-data-[variant=segmented]/tabs-list:data-active:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.05)] dark:group-data-[variant=segmented]/tabs-list:data-active:bg-card/95 dark:group-data-[variant=segmented]/tabs-list:data-active:shadow-[0_1px_3px_rgb(0_0_0/0.45),0_0_0_1px_rgb(255_255_255/0.06)] group-data-[variant=segmented]/tabs-list:[&_svg:not([class*='size-'])]:size-3.5"

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        segmentedTrigger,
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground group-data-[variant=segmented]/tabs-list:data-active:bg-card",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
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
