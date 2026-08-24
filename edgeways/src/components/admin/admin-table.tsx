import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { cn } from "@/lib/utils";

/** Contain-then-scroll so wide admin tables stay inside the page plate. */
export function AdminTableFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ScrollFadeEdges orientation="horizontal" className={cn("min-w-0", className)}>
      {children}
    </ScrollFadeEdges>
  );
}
