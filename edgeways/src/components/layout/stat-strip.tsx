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
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        surfaceLift,
        "rounded-lg px-3 py-2.5 dark:shadow-none",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      {sub != null && sub !== "" && (
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
