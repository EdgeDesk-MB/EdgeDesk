import Link from "next/link";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RELEASE_NOTES,
  RELEASE_NOTE_KIND_LABELS,
  type ReleaseNoteKind,
} from "@/content/release-notes";
import { ROADMAP_VERSION } from "@/content/roadmap";
import { filterPillState } from "@/lib/ui/surface-styles";
import { ArrowUpRight, ScrollText } from "lucide-react";

/** New = active Retained-style plate; Improved / Fixed = muted chip. */
function kindPillActive(kind: ReleaseNoteKind): boolean {
  return kind === "feature";
}

function formatGroupDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReleaseNotesPage() {
  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Release notes"
        description={`What's new in Edgeways, newest first. Currently ${ROADMAP_VERSION.currentLabel}.`}
        icon={ScrollText}
      />

      <div className="flex flex-col gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {RELEASE_NOTES.map((group) => (
          <Card key={`${group.date}-${group.title}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base">
                {group.title}
                <span className="text-xs font-normal text-muted-foreground">
                  {formatGroupDate(group.date)}
                </span>
              </CardTitle>
              <CardDescription>{group.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3.5">
                {group.entries.map((entry, i) => (
                  <li key={i} className="flex flex-col items-start gap-1 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={filterPillState(kindPillActive(entry.kind), {
                          compact: true,
                        })}
                      >
                        {RELEASE_NOTE_KIND_LABELS[entry.kind]}
                      </span>
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="inline-flex items-center gap-0.5 font-medium text-primary-text underline-offset-2 hover:underline"
                          aria-label={`Open ${entry.area}`}
                        >
                          {entry.area}
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden />
                        </Link>
                      ) : (
                        <span className="font-medium">{entry.area}</span>
                      )}
                    </div>
                    <p className="min-w-0 leading-snug text-muted-foreground">
                      {entry.text}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
