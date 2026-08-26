import { listDaySectionContent, listDaySectionLabel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Campaigns-style day split: label + hairline, then the day's cards or table.
 * Used on Campaigns, Casino Campaigns, Tracked Events, and Browse fixtures.
 * Hairline fixture rows inside a plate pass `listDaySectionContentNested`.
 */
export function ListDaySection({
  label,
  headingId,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  label: string;
  headingId?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className={cn("flex items-center gap-3 pt-1", headerClassName)}>
        <h2 id={headingId} className={listDaySectionLabel}>
          {label}
        </h2>
        <div className="h-px min-w-8 flex-1 bg-border" aria-hidden />
      </div>
      <div className={cn(listDaySectionContent, contentClassName)}>
        {children}
      </div>
    </section>
  );
}
