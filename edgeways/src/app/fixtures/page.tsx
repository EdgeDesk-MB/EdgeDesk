"use client";

import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { FixtureBrowser } from "@/components/events/fixture-browser";

export default function FixturesPage() {
  return (
    <PageShell>
      <PageHeader
        helpId="fixtures"
        title="Fixtures"
        description={
          <>
            Browse today&apos;s live and upcoming football fixtures and horse racing racecards.
            Hit + to track - finished matches stay on{" "}
            <Link href="/tracked-events" className="text-primary underline-offset-2 hover:underline">
              Tracked Events
            </Link>
            .
          </>
        }
      />
      <FixtureBrowser />
    </PageShell>
  );
}
