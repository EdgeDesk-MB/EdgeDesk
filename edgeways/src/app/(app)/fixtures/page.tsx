"use client";

import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { FixtureBrowser } from "@/components/events/fixture-browser";

export default function FixturesPage() {
  return (
    <PageShell fullHeight className="p-[var(--layout-page-x)]">
      <FixtureBrowser
        header={
          <PageHeader
            helpId="fixtures"
            title="Fixtures"
            description="Pick a sport and a day, then pin what you follow."
            rule={false}
          />
        }
      />
    </PageShell>
  );
}
