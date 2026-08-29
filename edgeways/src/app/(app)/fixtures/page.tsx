"use client";

import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { FixtureBrowser } from "@/components/events/fixture-browser";

export default function FixturesPage() {
  return (
    <PageShell>
      <PageHeader
        helpId="fixtures"
        title="Fixtures"
        description="Today's football and racing, with + on a row to track."
      />
      <FixtureBrowser />
    </PageShell>
  );
}
