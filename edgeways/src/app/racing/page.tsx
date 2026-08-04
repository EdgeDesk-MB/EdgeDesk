import { Suspense } from "react";
import { RacingDeskView } from "@/components/racing/racing-desk-view";
import { PageShell } from "@/components/page-shell";

export default function RacingPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        </PageShell>
      }
    >
      <RacingDeskView />
    </Suspense>
  );
}
