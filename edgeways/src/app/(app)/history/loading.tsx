import { HistoryListSkeleton } from "@/components/history/history-list-skeleton";
import { HistoryPageHeader } from "@/components/history/history-page-header";
import { PageFillScroll, PageFillShell } from "@/components/page-shell";

export default function HistoryLoading() {
  return (
    <PageFillShell>
      <HistoryPageHeader filter="all" viewDensity="expanded" disabled />
      <PageFillScroll>
        <HistoryListSkeleton />
      </PageFillScroll>
    </PageFillShell>
  );
}
