import { Skeleton } from "@/components/ui/skeleton";
import { listDaySectionContent, listDaySectionContentCompact, offerCampaignCardShell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} />;
}

/**
 * First-load History list: the same day band and card rhythm as the feed,
 * so the first page paints into place without a layout jump.
 */
export function HistoryListSkeleton({
  collapsed = false,
  cards = collapsed ? 6 : 3,
}: {
  collapsed?: boolean;
  cards?: number;
}) {
  return (
    <div className="flex flex-col">
      <span role="status" className="sr-only">
        Loading history
      </span>
      <div className="flex items-center gap-3 pt-1" aria-hidden>
        <Bone className="h-4 w-12" />
        <div className="h-px min-w-8 flex-1 bg-border" />
      </div>
      <div
        className={cn(listDaySectionContent, listDaySectionContentCompact, collapsed && "gap-2")}
        aria-hidden
      >
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className={cn(offerCampaignCardShell, "flex-col")}>
            <div
              className={cn(
                "flex w-full items-start",
                collapsed ? "min-h-[3.75rem] gap-2 px-3 py-2.5" : "gap-3 px-4 pt-4 pb-3"
              )}
            >
              <Bone className="mt-0.5 size-4 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Bone className="h-3 w-28" />
                <Bone className={cn("h-4", i % 2 ? "w-1/2" : "w-2/3")} />
                {collapsed ? null : <Bone className="h-3 w-1/3" />}
              </div>
              <Bone className="h-5 w-14 shrink-0" />
            </div>
            {collapsed ? null : (
              <div className="flex flex-col gap-2 border-t border-border/50 px-4 py-3 pl-11">
                {["w-1/2", "w-1/4", "w-16"].map((width) => (
                  <div key={width} className="flex flex-col gap-1">
                    <Bone className="h-3 w-10" />
                    <Bone className={cn("h-4", width)} />
                  </div>
                ))}
                <Bone className="mt-1 h-3 w-24 self-end" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
