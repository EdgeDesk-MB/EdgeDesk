import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import {
  PressButton,
  type PressButtonProps,
  type PressButtonRounded,
  type PressButtonSize,
  type PressButtonVariant,
} from "@/components/ui/button-3d"
import { fieldControl } from "@/lib/ui/surface-styles"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "skeuo-solid bg-primary font-semibold text-primary-foreground hover:bg-primary-hover active:shadow-[var(--ew-btn-shadow-pressed)]",
        pagePrimary:
          "skeuo-solid relative isolate overflow-hidden bg-primary font-semibold text-primary-foreground hover:bg-primary-hover active:shadow-[var(--ew-btn-shadow-pressed)]",
        outline: cn(
          fieldControl,
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:shadow-[var(--ew-btn-shadow-pressed)] dark:hover:bg-input/50"
        ),
        secondary:
          "skeuo-solid border-transparent bg-[#eeeeee] text-secondary-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-secondary-foreground active:shadow-[var(--ew-btn-shadow-pressed)] dark:bg-secondary dark:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] dark:aria-expanded:bg-secondary",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "skeuo-solid border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 active:shadow-[var(--ew-btn-shadow-pressed)] dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        success:
          "skeuo-solid border-transparent bg-success/15 text-success hover:bg-success/25 active:shadow-[var(--ew-btn-shadow-pressed)]",
        edge:
          "skeuo-solid border-transparent bg-edge font-semibold text-edge-foreground hover:brightness-95 active:shadow-[var(--ew-btn-shadow-pressed)] dark:hover:brightness-110",
        link: "text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 max-sm:h-10 gap-1.5 px-2.5 max-sm:px-3.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[var(--radius-button-sm)] px-2 text-xs in-data-[slot=button-group]:rounded-[var(--radius-button)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 max-sm:h-9 gap-1 rounded-[var(--radius-button-sm)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-[var(--radius-button)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 max-sm:h-11 gap-1.5 px-3 max-sm:px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 max-sm:size-10",
        "icon-xs":
          "size-6 rounded-[var(--radius-button-sm)] in-data-[slot=button-group]:rounded-[var(--radius-button)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[var(--radius-button-sm)] in-data-[slot=button-group]:rounded-[var(--radius-button)]",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const PRESSABLE_VARIANTS = new Set<string>([
  "default",
  "pagePrimary",
  "outline",
  "secondary",
  "destructive",
  "success",
  "edge",
])

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Pack face radius (pressable variants only). Use `none` for split halves. */
    rounded?: PressButtonRounded
    /** react-3d-button toggle mode (pressable variants only). */
    toggle?: boolean
    active?: boolean
    defaultActive?: boolean
    /** Toggle state callback — named to avoid clashing with native button onChange. */
    onToggleChange?: (active: boolean) => void
  }

/** Radix asChild triggers merge these — keep those Buttons on the flat path. */
function isRadixTriggerProps(props: Record<string, unknown>): boolean {
  return (
    props["aria-haspopup"] != null ||
    props["aria-expanded"] != null ||
    props["data-state"] != null ||
    props["data-slot"] === "dialog-trigger" ||
    props["data-slot"] === "popover-trigger" ||
    props["data-slot"] === "dropdown-menu-trigger"
  )
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  rounded,
  toggle,
  active,
  defaultActive,
  onToggleChange,
  ...props
}: ButtonProps) {
  const use3d =
    !asChild &&
    !isRadixTriggerProps(props as Record<string, unknown>) &&
    variant != null &&
    PRESSABLE_VARIANTS.has(variant)

  if (use3d) {
    const {
      type,
      onClick,
      disabled,
      children,
      title,
      id,
      name,
      form,
      onMouseDown,
      onMouseUp,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      tabIndex,
      autoFocus,
      value,
      // Pack owns its root ref — never forward (would break press animation).
      ref: _ref,
      ...rest
    } = props

    return (
      <PressButton
        variant={variant as PressButtonVariant}
        size={(size ?? "default") as PressButtonSize}
        rounded={rounded}
        className={className}
        type={type}
        onClick={onClick as PressButtonProps["onClick"]}
        disabled={disabled}
        title={title}
        id={id}
        name={name}
        form={form}
        toggle={toggle}
        active={active}
        defaultActive={defaultActive}
        onChange={onToggleChange}
        containerProps={{
          onMouseDown,
          onMouseUp,
          onKeyDown,
          onKeyUp,
          onFocus,
          onBlur,
          tabIndex,
          autoFocus,
          value,
          ...rest,
        }}
      >
        {children}
      </PressButton>
    )
  }

  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
