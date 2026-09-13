import Link from "next/link";
import { PageHeader } from "@/components/help/page-header";
import { PageGrid, PageMain, PageShell, PageSide } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ArrowUpRight } from "lucide-react";
import {
  RELEASE_NOTES,
  RELEASE_NOTE_KIND_LABELS,
  type ReleaseNoteEntry,
  type ReleaseNoteKind,
} from "@/content/release-notes";
import { cn } from "@/lib/utils";


function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  
  // Reset time to compare full days
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = nowOnly.getTime() - dateOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  
  const weeksAgo = Math.floor(diffDays / 7);
  return `${weeksAgo} weeks ago`;
}

// Kind badge colors matching Slack's style
const KIND_COLORS = {
  feature: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  improvement: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  fix: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700",
};


export default function ReleaseNotesPage() {
  return (
    <PageShell className="gap-8">
      <PageHeader
        title="Release notes"
        description="What's new, improved and fixed."
        icon={ScrollText}
      />

      <div className="flex flex-col gap-12 pb-12 sm:pb-0">
        {RELEASE_NOTES.map((group, index) => {
          const isLast = index === RELEASE_NOTES.length - 1;
          
          // Group entries by kind for bullet-point style grouping
          const groupedEntries = group.entries.reduce(
            (acc, entry) => {
              if (!acc[entry.kind]) acc[entry.kind] = [];
              acc[entry.kind].push(entry);
              return acc;
            },
            {} as Record<ReleaseNoteKind, ReleaseNoteEntry[]>
          );

          return (
            <div
              key={`${group.date}-${group.title}`}
              className={cn(
                "flex flex-col gap-6",
                !isLast && "border-b border-border/60 pb-12"
              )}
            >
              {/* Individual release entry */}
              <PageGrid>
                {/* Left column: date, title, summary */}
                <PageSide className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <time
                      dateTime={group.date}
                      className="text-sm font-semibold text-muted-foreground"
                    >
                      {formatDate(group.date)}
                    </time>
                    <h3 className="text-lg leading-6 md:text-xl md:leading-7 font-bold tracking-tight text-foreground">
                      {group.title}
                    </h3>
                  </div>

                  <p className="text-sm md:text-base text-foreground leading-relaxed">
                    {group.summary}
                  </p>
                </PageSide>

                {/* Right column: entries grouped by kind, boxed to match the Guides page */}
                 <PageMain>
                   <Card className="p-8">
                     <CardContent className="flex flex-col gap-8 px-0">
                      {(Object.keys(groupedEntries) as ReleaseNoteKind[]).map((kind) => {
                        const kindEntries = groupedEntries[kind];
                        if (!kindEntries.length) return null;

                        return (
                          <div key={kind} className="flex flex-col gap-1">
                            {/* Kind badge header */}
                            <div className="flex items-center gap-2 mb-3">
                              <h4 className="font-bold tracking-wide text-sm">
                                {RELEASE_NOTE_KIND_LABELS[kind]}
                              </h4>
                            </div>

                            {/* Entries as bullet points */}
                            <ul className="flex flex-col gap-0">
                              {kindEntries.map((kentry, kindex) => (
                                <li
                                  key={kindex}
                                  className="flex items-start gap-3 pl-1 pb-4 last:border-0"
                                >
                                  {/* Bullet point - colored circle matching kind */}
                                  <span className={cn(
                                    "mt-2 flex size-1.5 shrink-0 items-center justify-center rounded-full",
                                    kind === "feature" && "bg-green-600 dark:bg-green-500",
                                    kind === "improvement" && "bg-blue-600 dark:bg-blue-500",
                                    kind === "fix" && "bg-gray-600 dark:bg-gray-400"
                                  )} />

                                  <div className="flex flex-col gap-1 min-w-0">
                                    {/* Area with link if available */}
                                    <div className="flex items-center gap-2">
                                      {kentry.href ? (
                                        <Link
                                          href={kentry.href}
                                          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors"
                                          aria-label={`Open ${kentry.area}`}
                                        >
                                          {kentry.area}
                                          <ArrowUpRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
                                        </Link>
                                      ) : (
                                        <span className="font-semibold text-foreground">{kentry.area}</span>
                                      )}
                                    </div>

                                    {/* Entry text */}
                                    <p className="min-w-0 leading-relaxed text-muted-foreground">
                                      {kentry.text}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </PageMain>
              </PageGrid>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
