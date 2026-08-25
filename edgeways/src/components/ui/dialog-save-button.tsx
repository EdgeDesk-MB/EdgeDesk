"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ShortcutKeys } from "@/components/ui/kbd";
import { usePreferMetaModifier } from "@/hooks/use-prefer-meta-modifier";
import { DIALOG_SAVE_ATTR, dialogSaveHintKeys } from "@/lib/keyboard/dialog-save";
import { cn } from "@/lib/utils";

export function DialogSaveKeys({
  onPrimary = true,
  className,
}: {
  onPrimary?: boolean;
  className?: string;
}) {
  const isMac = usePreferMetaModifier();
  if (isMac === null) return null;

  return (
    <span aria-hidden className="hidden shortcut-hint:inline-flex">
      <ShortcutKeys
        keys={dialogSaveHintKeys(isMac)}
        kind="chord"
        className={cn(
          "shrink-0 [&_[data-slot=kbd]]:h-5 [&_[data-slot=kbd]]:min-w-5 [&_[data-slot=kbd]]:px-1 [&_[data-slot=kbd]]:text-[11px]",
          onPrimary &&
            "[&_[data-slot=kbd]]:border-current/30 [&_[data-slot=kbd]]:bg-current/18 [&_[data-slot=kbd]]:text-current",
          className
        )}
      />
    </span>
  );
}

type SaveButtonProps = ComponentProps<typeof Button> & {
  children: ReactNode;
};

export function DialogSaveButton({
  children,
  className,
  variant = "default",
  ...props
}: SaveButtonProps) {
  const onPrimary = variant !== "outline" && variant !== "ghost" && variant !== "secondary";
  return (
    <Button
      variant={variant}
      className={className}
      {...props}
      {...{ [DIALOG_SAVE_ATTR]: "" }}
    >
      <span className="inline-flex items-center gap-2">
        {children}
        <DialogSaveKeys onPrimary={onPrimary} />
      </span>
    </Button>
  );
}
