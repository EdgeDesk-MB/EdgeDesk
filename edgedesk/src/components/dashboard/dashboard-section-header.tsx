import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionBar } from "@/lib/ui/layout-spacing";

export function DashboardSectionHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(sectionBar, "shrink-0 py-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <h2 className="text-sm font-bold leading-snug text-foreground">{title}</h2>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
