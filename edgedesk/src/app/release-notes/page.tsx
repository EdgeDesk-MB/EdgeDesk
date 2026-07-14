import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
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
import { ScrollText } from "lucide-react";

function kindBadgeVariant(kind: ReleaseNoteKind): "default" | "secondary" | "outline" {
  switch (kind) {
    case "feature":
      return "default";
    case "improvement":
      return "secondary";
    case "fix":
      return "outline";
  }
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
        description={`What's new in EdgeDesk, newest first. Currently ${ROADMAP_VERSION.currentLabel}.`}
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
              <ul className="flex flex-col gap-2.5">
                {group.entries.map((entry, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Badge
                      variant={kindBadgeVariant(entry.kind)}
                      className="mt-0.5 shrink-0 text-[10px]"
                    >
                      {RELEASE_NOTE_KIND_LABELS[entry.kind]}
                    </Badge>
                    <span className="min-w-0 leading-snug">
                      <span className="font-medium">{entry.area}</span>
                      {" · "}
                      <span className="text-muted-foreground">{entry.text}</span>
                    </span>
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
