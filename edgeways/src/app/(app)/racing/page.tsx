import { Suspense } from "react";
import { RacingDeskView } from "@/components/racing/racing-desk-view";
import { PageLoading } from "@/components/page-loading";

export default function RacingPage() {
  return (
    <Suspense
      fallback={
        <PageLoading
          label="Loading Racing Desk"
          description="Opening today's racecards…"
        />
      }
    >
      <RacingDeskView />
    </Suspense>
  );
}
