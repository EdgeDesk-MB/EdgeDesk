"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { CircleHelp, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal"
import { shouldCommitDialogSave } from "@/lib/keyboard/dialog-save"
import { usePauseAppStatePolling } from "@/components/app-state-provider"
import {
  dialogDescription,
  dialogHeaderBand,
  dialogTitle,
} from "@/lib/ui/surface-styles"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "dialog-overlay fixed inset-0 z-50 bg-black/20 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Below `sm`, dialogs render as bottom sheets (mobile best practice) unless
 * `mobile="center"` opts back into the desktop-style centred modal - reserve
 * that for small confirm prompts ("Are you sure?" deletes).
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  mobile = "sheet",
  onFocusOutside,
  onPointerDownOutside,
  onInteractOutside,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  mobile?: "sheet" | "center"
}) {
  // Every open modal freezes the desk poll so NumberFlow / live feed cannot
  // repaint through the overlay.
  usePauseAppStatePolling(true)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Light grey fill + glassy Shopify face (.modal-surface). Outer drop
          // and light hairline live on --modal-shadow (see globals.css).
          "modal-surface fixed top-1/2 left-1/2 z-50 grid w-full min-w-0 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-page p-4 text-sm text-foreground duration-100 outline-none sm:max-w-sm dark:bg-card data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          mobile === "sheet" &&
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:data-open:slide-in-from-bottom-1/2 max-sm:data-open:zoom-in-100 max-sm:data-closed:slide-out-to-bottom-1/2 max-sm:data-closed:zoom-out-100",
          className
        )}
        {...props}
        onKeyDownCapture={(e) => {
          const save = shouldCommitDialogSave(e.nativeEvent, e.currentTarget)
          if (!save) return
          e.preventDefault()
          e.stopPropagation()
          save.click()
        }}
        onKeyDown={onKeyDown}
        onFocusOutside={(e) => {
          preventDialogDismissOnPortaledContent(e)
          onFocusOutside?.(e)
        }}
        onPointerDownOutside={(e) => {
          preventDialogDismissOnPortaledContent(e)
          onPointerDownOutside?.(e)
        }}
        onInteractOutside={(e) => {
          preventDialogDismissOnPortaledContent(e)
          onInteractOutside?.(e)
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "absolute top-4 right-3 z-10 flex size-8 items-center justify-center rounded-lg",
              "bg-transparent text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        dialogHeaderBand,
        // Bleed to the modal edges when DialogContent still has default p-4.
        "-mx-4 -mt-4",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex min-w-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 max-sm:rounded-b-none sm:flex-row sm:flex-wrap sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(dialogTitle, className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  explainer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description> & {
  /** Extra help beside the description. Use DialogExplainer. */
  explainer?: React.ReactNode
}) {
  const description = (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        dialogDescription,
        explainer && "w-fit max-w-full",
        "*:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
  if (!explainer) return description
  return (
    <div className="flex min-w-0 max-w-full items-center gap-0.5">
      {description}
      {explainer}
    </div>
  )
}

/** Extra help that does not belong in the header description. */
function DialogExplainer({
  title,
  children,
  label,
  className,
}: {
  title?: string
  children: React.ReactNode
  label?: string
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-sm align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={label ?? title ?? "More about this"}
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          {title ? <PopoverTitle>{title}</PopoverTitle> : null}
          {typeof children === "string" ? (
            <PopoverDescription>{children}</PopoverDescription>
          ) : (
            <div className="text-sm leading-snug text-muted-foreground">
              {children}
            </div>
          )}
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
