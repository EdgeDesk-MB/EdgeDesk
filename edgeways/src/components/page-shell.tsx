import { cn } from "@/lib/utils";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { pageShell, pageShellCompact, sectionBar, sectionMeta } from "@/lib/ui/layout-spacing";
import {
  FIXTURE_TAPE_GUTTER_PX,
  sectionDescription,
  sectionTitle,
} from "@/lib/ui/surface-styles";

/** Full width inside the centred page panel */
export const PAGE_SHELL_CLASS = "flex w-full min-w-0 max-w-full flex-col overflow-x-clip";

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

/** Fill-height desk page: padded column, pinned chrome, nested list scroll. */
export function PageFillShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PageShell fullHeight className={cn("p-[var(--layout-page-x)]", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </PageShell>
  );
}

/** Nested fade scroll under pinned header chrome. Pad matches the card gutter. */
export function PageFillScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ScrollFadeEdges
      className={cn("min-h-0 flex-1", className)}
      fadeClassName="from-page"
      fadeSize={FIXTURE_TAPE_GUTTER_PX}
      edgeRule
      scrollClassName="app-scroll-nested py-4"
    >
      {children}
    </ScrollFadeEdges>
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
