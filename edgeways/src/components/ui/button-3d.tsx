"use client";

import * as React from "react";
import { Button3D, type ButtonType } from "react-3d-button";
import "react-3d-button/styles";

import { cn } from "@/lib/utils";

/** Edgeways Button variants that map onto react-3d-button types. */
export type PressButtonVariant =
  | "default"
  | "pagePrimary"
  | "outline"
  | "secondary"
  | "destructive"
  | "success";

export type PressButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

const VARIANT_TO_TYPE: Record<PressButtonVariant, ButtonType> = {
  default: "primary",
  pagePrimary: "primary",
  outline: "tertiary",
  secondary: "secondary",
  destructive: "danger",
  success: "success",
};

/** Package size class (density is refined via CSS on data-size). */
const SIZE_TO_PKG: Record<PressButtonSize, "xs" | "sm" | "md" | "lg"> = {
  default: "sm",
  xs: "xs",
  sm: "sm",
  lg: "md",
  icon: "sm",
  "icon-xs": "xs",
  "icon-sm": "sm",
  "icon-lg": "md",
};

/** Match flat `buttonVariants` heights (pack md defaults to 40px — too tall vs h-9). */
const SIZE_TO_HEIGHT_CLASS: Record<PressButtonSize, string> = {
  default: "h-8",
  xs: "h-6",
  sm: "h-7",
  lg: "h-9",
  icon: "size-8",
  "icon-xs": "size-6",
  "icon-sm": "size-7",
  "icon-lg": "size-9",
};

export type PressButtonRounded = "none" | "sm" | "md" | "lg" | "xl" | "full";

export type PressButtonProps = {
  variant?: PressButtonVariant;
  size?: PressButtonSize;
  /** Pack radius — use `full` for filter pills. */
  rounded?: PressButtonRounded;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  /** Native button type (submit / button / reset). */
  type?: "button" | "submit" | "reset";
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  title?: string;
  id?: string;
  name?: string;
  form?: string;
  /** Controlled / uncontrolled toggle (react-3d-button). */
  toggle?: boolean;
  active?: boolean;
  defaultActive?: boolean;
  onChange?: (active: boolean) => void;
  /** Extra attributes merged onto the pack’s root button (data-*, aria-*, etc.). */
  containerProps?: React.HTMLAttributes<HTMLElement> & Record<string, unknown>;
};

/**
 * Edgeways-themed react-3d-button wrapper for press surfaces.
 * Prefer `Button` for normal call sites; use this for toggle / success mapping.
 */
export function PressButton({
  variant = "default",
  size = "default",
  rounded = "md",
  className,
  children,
  disabled,
  type: htmlType = "button",
  onClick,
  title,
  id,
  name,
  form,
  toggle,
  active,
  defaultActive,
  onChange,
  containerProps,
}: PressButtonProps) {
  const iconOnly = size.startsWith("icon");

  return (
    <Button3D
      type={VARIANT_TO_TYPE[variant]}
      size={SIZE_TO_PKG[size]}
      rounded={rounded}
      ripple={false}
      moveEvents
      placeholder={false}
      iconOnly={iconOnly}
      disabled={disabled}
      toggle={toggle}
      active={active}
      defaultActive={defaultActive}
      onChange={onChange}
      onPress={(event) => onClick?.(event)}
      className={cn("edgeways-btn-3d", SIZE_TO_HEIGHT_CLASS[size], className)}
      containerProps={
        {
          "data-slot": "button",
          "data-variant": variant,
          "data-size": size,
          "data-edgeways-btn": "",
          type: htmlType,
          title,
          id,
          name,
          form,
          ...containerProps,
        } as React.HTMLAttributes<HTMLElement>
      }
    >
      {children}
    </Button3D>
  );
}
