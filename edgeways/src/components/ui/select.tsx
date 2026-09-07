"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges"
import { fieldControl, overlayMenuHover } from "@/lib/ui/surface-styles"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        fieldControl,
        "flex w-fit items-center justify-between gap-1.5 py-2 pr-2 pl-2.5 text-sm whitespace-nowrap outline-none select-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-placeholder:text-muted-foreground data-[size=default]:h-8 max-sm:data-[size=default]:h-10 data-[size=sm]:h-7 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 *:data-[slot=select-value]:overflow-hidden dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  sideOffset = 4,
  collisionPadding = 8,
  matchTrigger = false,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  /** Pin the menu to the trigger. Only for title lists (offer Race). Never for identity UI. */
  matchTrigger?: boolean
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-align-trigger={position === "item-aligned"}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // Overflow stays on the Viewport. Content must not scroll: Radix
          // scroll chevrons remount on first wheel and call scrollIntoView,
          // which is the jump on Category and every other long select.
          "relative z-[100] max-h-(--radix-select-content-available-height) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          position === "item-aligned" && "min-w-36",
          // Default: hug the widest row so names, badges and amounts stay
          // readable. Never narrower than the trigger. Cap at the overlay gutter.
          // matchTrigger: pin to the field (title lists only, e.g. offer Race).
          position === "popper" &&
            cn(
              "max-w-[min(var(--radix-select-content-available-width),calc(100vw-var(--overlay-gutter)))] data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
              matchTrigger
                ? "w-(--radix-select-trigger-width) min-w-32"
                : "w-max min-w-(--radix-select-trigger-width)"
            ),
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <ScrollFadeEdges
          scrollAsChild
          fadeClassName="from-popover"
          className="max-h-(--radix-select-content-available-height) flex-none"
        >
          <SelectPrimitive.Viewport
            data-position={position}
            className={cn(
              "app-scroll-overlay min-h-0 max-h-(--radix-select-content-available-height) p-1 overscroll-contain [overflow-anchor:none]",
              position === "popper" && "w-full",
              position === "item-aligned" &&
                "w-full min-w-(--radix-select-trigger-width)"
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
        </ScrollFadeEdges>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // ItemText strips className/style in Radix — stretch it from the Item instead.
        overlayMenuHover,
        "relative flex w-full cursor-default items-center gap-1.5 whitespace-nowrap rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_[data-slot=select-item-text]]:flex [&_[data-slot=select-item-text]]:min-w-0 [&_[data-slot=select-item-text]]:w-full [&_[data-slot=select-item-text]]:flex-1 [&_[data-slot=select-item-text]]:items-center [&_[data-slot=select-item-text]]:gap-2 has-[[data-slot=select-item-row]]:min-w-0 has-[[data-slot=select-item-row]]:overflow-hidden has-[[data-slot=select-item-row]]:pr-1.5 has-[[data-slot=select-item-row]]:[&_[data-slot=select-item-text]]:block has-[[data-slot=select-item-row]]:[&_[data-slot=select-item-text]]:overflow-hidden has-[[data-slot=select-item-row]]:[&_[data-slot=select-item-indicator]]:hidden has-[[data-slot=select-item-row]]:data-[state=checked]:bg-accent has-[[data-slot=select-item-row]]:data-[state=checked]:focus:bg-accent",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText data-slot="select-item-text">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

/** Truncated label with trailing meta pinned right (race runner count, kick-off). */
function SelectItemRow({
  label,
  trailing,
  className,
}: {
  label: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <span
      data-slot="select-item-row"
      className={cn("flex w-full min-w-0 flex-1 items-center justify-between gap-3", className)}
    >
      <span
        className="min-w-0 flex-1 truncate"
        title={typeof label === "string" ? label : undefined}
      >
        {label}
      </span>
      {trailing ? (
        <span className="ml-auto shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {trailing}
        </span>
      ) : null}
    </span>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemRow,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
