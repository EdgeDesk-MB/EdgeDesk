import { cn } from "@/lib/utils";
import { pageShell, pageShellCompact, sectionBar, sectionMeta } from "@/lib/ui/layout-spacing";
import { sectionDescription, sectionTitle } from "@/lib/ui/surface-styles";

/** Full width inside the centred page panel */
export const PAGE_SHELL_CLASS = "flex w-full flex-col";

export function PageShell({
  children,
  className,
  fullHeight,
  compact,
}: {
  children: React.ReactNode;
  className?: string;
  /** Fill the centred page panel height (Live Dashboard) */
  fullHeight?: boolean;
  /** @deprecated Alias for `fullHeight` */
  compact?: boolean;
}) {
  const useCompact = compact ?? fullHeight;
  return (
    <div
      className={cn(
        PAGE_SHELL_CLASS,
        useCompact ? pageShellCompact : pageShell,
        useCompact &&
          "flex h-[var(--layout-page-min-h)] min-h-[var(--layout-page-min-h)] flex-col overflow-hidden",
        !useCompact && "w-full",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Padded body region inside a page */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[var(--layout-stack-gap)]", className)}>
      {children}
    </div>
  );
}

/** 5-column grid - main 3/5, side 2/5 at lg+ */
export function PageGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-[var(--layout-stack-gap)] lg:grid-cols-5 lg:gap-6", className)}>
      {children}
    </div>
  );
}

export function PageMain({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 lg:col-span-3", className)}>{children}</div>;
}

export function PageSide({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 lg:col-span-2", className)}>{children}</div>;
}

/** Section header for list panels inside cards */
export function SectionHeader({
  title,
  description,
  action,
  className,
  meta,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  meta?: boolean;
}) {
  return (
    <div className={cn(meta ? sectionMeta : sectionBar, className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={sectionTitle}>{title}</h2>
          {description && <p className={cn(sectionDescription, "mt-0.5")}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

/** Calculator pages: centred narrow form column */
export function CalculatorShell({
  children,
  className,
  contentClassName,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Use max-w-4xl instead of max-w-3xl (dutching, EV, etc.) */
  wide?: boolean;
}) {
  return (
    <PageShell className={className}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-[var(--layout-stack-gap)]",
          contentClassName ?? (wide ? "max-w-4xl" : "max-w-3xl")
        )}
      >
        {children}
      </div>
    </PageShell>
  );
}
