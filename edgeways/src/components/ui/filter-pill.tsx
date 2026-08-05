"use client";

import * as React from "react";

import { PressButton } from "@/components/ui/button-3d";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export type FilterPillProps = {
  active: boolean;
  onClick?: (event: React.MouseEvent | React.TouchEvent) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Home chart / feed chips — flat, no PressButton. */
  compact?: boolean;
  hasCount?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  id?: string;
};

/**
 * Circular filter / tab chip.
 * Default size uses PressButton (Shopify face + press). Compact stays flat
 * and forwards ref (for TooltipTrigger asChild on Home chart chips).
 */
export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  function FilterPill(
    {
      active,
      onClick,
      children,
      className,
      disabled,
      compact = false,
      hasCount = false,
      type = "button",
      title,
      id,
    },
    ref
  ) {
    if (compact) {
      return (
        <button
          ref={ref}
          type={type}
          id={id}
          title={title}
          disabled={disabled}
          onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
          className={cn(filterPillState(active, { compact, hasCount }), className)}
        >
          {children}
        </button>
      );
    }

    return (
      <PressButton
        variant="outline"
        size="default"
        type={type}
        id={id}
        title={title}
        disabled={disabled}
        rounded="full"
        onClick={onClick}
        className={cn(
          "edgeways-filter-pill",
          hasCount && "edgeways-filter-pill--count",
          active && "edgeways-filter-pill--active",
          className
        )}
        containerProps={{
          "data-pill-active": active ? "true" : "false",
        }}
      >
        {children}
      </PressButton>
    );
  }
);
