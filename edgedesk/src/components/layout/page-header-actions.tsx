import { cn } from "@/lib/utils";

/** Stats + buttons in a page header — 16px gap, vertically centred */
export function PageHeaderActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-4", className)}>
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

/** Primary page CTA — larger than default toolbar buttons */
export const pagePrimaryButtonProps = { size: "lg" as const };

/** Secondary page action (outline, export, etc.) */
export const pageSecondaryButtonProps = { size: "default" as const };
