import { cn } from "@/lib/utils";

/** Cloth number badge - shows silk image when URL available. */
export function RunnerCloth({
  number,
  silkUrl,
  size = "md",
  className,
}: {
  number: string;
  silkUrl?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? "size-7 text-[11px]" : "size-8 text-xs";

  if (silkUrl?.trim()) {
    return (
      <img
        src={silkUrl}
        alt={`Cloth ${number}`}
        className={cn(dim, "shrink-0 rounded-sm object-cover ring-1 ring-border", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm bg-muted font-bold tabular-nums text-foreground ring-1 ring-border",
        dim,
        className
      )}
      title={`Cloth ${number}`}
    >
      {number}
    </span>
  );
}
