import { cn } from "@/lib/utils";

/**
 * Stats + buttons in a page header. Full width under the title below `md`,
 * then a compact cluster on the right. Default gap is 8px between loose
 * children. When pairing `PageHeaderStatGroup` with `PageHeaderButtonGroup`,
 * pass `className="gap-6"` for the 24px gap between supporting text and the
 * button cluster.
 */
export function PageHeaderActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0", className)}>
      {children}
    </div>
  );
}

/** Supporting label + value beside a page action button */
export function PageHeaderStat({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm leading-none", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{children}</span>
    </span>
  );
}

/** Cluster of `PageHeaderStat` values - 8px between stats */
export function PageHeaderStatGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}

/** Contained page-header button cluster - keeps CTAs together at 8px */
export function PageHeaderButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0", className)}>
      {children}
    </div>
  );
}

/** Primary page CTA - same h-8 as outline siblings; brand yellow with shine */
export const pagePrimaryButtonProps = {
  size: "default" as const,
  variant: "pagePrimary" as const,
};

/** Secondary page action (outline, export, etc.) - matches primary height */
export const pageSecondaryButtonProps = { size: "default" as const };

/**
 * Cluster for two or more outline (non-ghost) action buttons.
 * Uses gap-2.5 (10px), 4px more than the default inline action gap (gap-1.5 / 6px).
 */
export const outlineButtonGroup = "flex flex-wrap items-center gap-2.5";
