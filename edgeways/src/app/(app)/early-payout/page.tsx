import { Suspense } from "react";
import { TwoUpDeskView } from "@/components/twoup/two-up-desk-view";
import { PageLoading } from "@/components/page-loading";

export default function EarlyPayoutDeskPage() {
  return (
    <Suspense
      fallback={
        <PageLoading
          label="Loading Early-payout Desk"
          description="Opening today's early-payout board…"
        />
      }
    >
      <TwoUpDeskView />
    </Suspense>
  );
}
