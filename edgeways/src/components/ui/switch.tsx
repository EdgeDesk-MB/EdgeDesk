"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  tone = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
  /**
   * default — primary on, muted off. On-thumb is `--primary-foreground`
   * so ink/white tracks the brand plate in both themes.
   * onPanel — black/white opacity on a bookie/exchange tint (never brand green).
   * pnl — `--profit` on, same muted off as onPanel. White thumb; ink
   * `--profit-foreground` in dark when on. Not for optional extras
   * (Advanced, Use %, settings).
   */
  tone?: "default" | "onPanel" | "pnl"
}) {
  const onPanel = tone === "onPanel"
  const pnl = tone === "pnl"

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      data-tone={tone}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        onPanel
          ? "data-checked:bg-black/45 data-unchecked:bg-black/20 dark:data-checked:bg-white/45 dark:data-unchecked:bg-white/20"
          : pnl
            ? "data-checked:bg-profit data-unchecked:bg-black/20 dark:data-unchecked:bg-white/20"
            : "data-checked:bg-primary data-unchecked:bg-foreground/30 dark:data-unchecked:bg-input/80",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0",
          onPanel
            ? "bg-white dark:bg-white"
            : pnl
              ? "bg-white dark:data-checked:bg-profit-foreground"
              : "bg-white data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
