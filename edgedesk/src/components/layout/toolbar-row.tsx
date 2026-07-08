import { cn } from "@/lib/utils";
import { pageSectionMeta } from "@/lib/ui/layout-spacing";

export function ToolbarRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        pageSectionMeta,
        "flex flex-wrap items-center gap-2 border-t-0",
        className
      )}
    >
      {children}
    </div>
  );
}
