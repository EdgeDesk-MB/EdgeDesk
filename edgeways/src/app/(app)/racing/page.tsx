import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { RacingDeskView } from "@/components/racing/racing-desk-view";
import { PageShell } from "@/components/page-shell";

function RacingDeskFallback() {
  return (
    <PageShell fullHeight>
      <div
        className="flex min-h-[var(--layout-page-min-h)] flex-1 flex-col items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Loading racing desk"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">Fetching today&apos;s racecards…</p>
      </div>
    </PageShell>
  );
}

export default function RacingPage() {
  return (
    <Suspense fallback={<RacingDeskFallback />}>
      <RacingDeskView />
    </Suspense>
  );
}
