import { Clock } from "lucide-react";
import { listDaySectionContent, listDaySectionLabel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Campaigns-style day split: label + hairline, then the day's cards or table.
 * Used on Campaigns, Casino Campaigns, Tracked Events, Profit Tracker,
 * History, and Browse fixtures.
 * Hairline fixture rows inside a plate pass `listDaySectionContentNested`.
 * `upcoming` is Profit Tracker only: clock mark for days after today.
 */
export function ListDaySection({
  label,
  headingId,
  upcoming = false,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  label: string;
  headingId?: string;
  upcoming?: boolean;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <div className={cn("flex items-center gap-3 pt-1", headerClassName)}>
        <h2
          id={headingId}
          className={cn(listDaySectionLabel, "flex items-center gap-1.5")}
        >
          {upcoming ? (
            <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
          {upcoming ? <span className="sr-only">Upcoming, </span> : null}
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
