import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { surfaceLift } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Contain-then-scroll so wide admin tables stay inside the page plate.
 * The lifted surface + ring gives the table a clean boundary on the page.
 */
export function AdminTableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        surfaceLift,
        "min-w-0 overflow-hidden rounded-lg px-2 py-1",
        className
      )}
    >
      <ScrollFadeEdges orientation="horizontal" fadeClassName="from-card">
        {children}
      </ScrollFadeEdges>
    </div>
  );
}
