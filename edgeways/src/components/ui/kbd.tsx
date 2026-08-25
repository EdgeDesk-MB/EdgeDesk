import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  ...props
}: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border/80 bg-muted px-1.5",
        "font-sans text-xs font-medium text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function ShortcutKeys({
  keys,
  kind,
  className,
}: {
  keys: string[];
  kind: "chord" | "sequence";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && kind === "sequence" ? (
            <span className="text-xs text-muted-foreground">then</span>
          ) : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}
