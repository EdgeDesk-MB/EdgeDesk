import { cn } from "@/lib/utils";
import { surfaceLift } from "@/lib/ui/surface-styles";

const columnClasses = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
} as const;

export function StatStrip({
  children,
  columns = 5,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", columnClasses[columns], className)}>
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  className,
  valueClassName,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  /** Overrides the default text-2xl / h-7 value row. */
  valueClassName?: string;
  /** When set with onClick, tile renders as a selectable summary tab. */
  active?: boolean;
  onClick?: () => void;
}) {
  const interactive = onClick != null;
  const classNames = cn(
    surfaceLift,
    // 16px inset. Top-align in a stretch grid.
    // Transparent 1px border reserved so selected shadow rim does not shift layout.
    "flex flex-col items-stretch justify-start rounded-lg border border-transparent px-4 py-4 text-left",
    interactive &&
      cn(
        "cursor-pointer transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page",
        // Drop surfaceLift ring when selected — rim is the selected box-shadow only.
        active && "ring-0"
      ),
    className
  );

  // Fixed three-row stack on every tile (sub slot always reserved) so
  // Races / P&L match Tracked / Active bets, and MoneyFlow cannot collapse
  // the gaps. Label→value 2px; value→supporting text 10px.
  const hasSub = sub != null && sub !== "";
  const body = (
    <div className="flex w-full flex-col">
      <p className="h-3.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "mt-0.5 flex h-7 items-center text-2xl font-bold leading-none tabular-nums tracking-tight text-foreground [&_*]:leading-none",
          valueClassName
        )}
      >
        {value}
      </div>
      <p
        className={cn(
          "mt-2.5 h-3.5 text-[11px] leading-none",
          hasSub ? "text-muted-foreground" : "invisible select-none"
        )}
        aria-hidden={!hasSub}
      >
        {hasSub ? sub : "\u00a0"}
      </p>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-stat-tile=""
        aria-pressed={active === true}
        className={classNames}
      >
        {body}
      </button>
    );
  }

  return (
    <div data-stat-tile="" className={classNames}>
      {body}
    </div>
  );
}
