"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SplitButtonProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

type SplitSegmentProps = React.ComponentProps<typeof Button>;

/**
 * Connected split button — leading primary action + trailing related action.
 * Gap is set in globals.css (`[data-slot=split-button]`); keep class in sync.
 */
function SplitButtonRoot({ children, className, title }: SplitButtonProps) {
  return (
    <span
      data-slot="split-button"
      title={title}
      className={cn("inline-flex items-stretch gap-px", className)}
    >
      {children}
    </span>
  );
}

function SplitButtonLeading({ className, ...props }: SplitSegmentProps) {
  return (
    <Button
      data-slot="split-button-leading"
      className={cn("edgeways-split-leading", className)}
      {...props}
    />
  );
}

function SplitButtonTrailing({ className, ...props }: SplitSegmentProps) {
  return (
    <Button
      data-slot="split-button-trailing"
      className={cn("edgeways-split-trailing", className)}
      {...props}
    />
  );
}

export const SplitButton = Object.assign(SplitButtonRoot, {
  Leading: SplitButtonLeading,
  Trailing: SplitButtonTrailing,
});
