import Link from "next/link";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ROADMAP_CATEGORIES,
  ROADMAP_STATUS_LABELS,
  ROADMAP_VERSION,
  roadmapStats,
} from "@/content/roadmap";
import { roadmapStatusBadgeVariant } from "@/lib/ui/status-badges";
import { Map } from "lucide-react";

export default function RoadmapPage() {
  const stats = roadmapStats();

  return (
    <PageShell>
      <PageHeader
        title="Roadmap"
        description="Shipped, in progress and planned."
        icon={Map}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Where we are</CardTitle>
          <CardDescription>
            Edgeways is in <Badge variant="secondary">{ROADMAP_VERSION.currentLabel}</Badge>{" "}
            today. {ROADMAP_VERSION.currentNote}{" "}
            <Badge>{ROADMAP_VERSION.targetLabel}</Badge> {ROADMAP_VERSION.targetLead}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{ROADMAP_VERSION.targetNote}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span>
              <span className="font-semibold text-foreground tabular-nums">{stats.done}</span> done
            </span>
            <span>
              <span className="font-semibold text-foreground tabular-nums">{stats.inProgress}</span>{" "}
              in progress
            </span>
            <span>
              <span className="font-semibold text-foreground tabular-nums">{stats.planned}</span>{" "}
              planned
            </span>
            <span>
              <span className="font-semibold text-foreground tabular-nums">{stats.future}</span>{" "}
              future
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {(["done", "in_progress", "planned", "future"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <Badge variant={roadmapStatusBadgeVariant(s)} className="text-[11px]">
              {ROADMAP_STATUS_LABELS[s]}
            </Badge>
          </span>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ROADMAP_CATEGORIES.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-2">
              <CardTitle section>{category.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {category.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-selection-subtle"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{item.title}</p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <Badge variant={roadmapStatusBadgeVariant(item.status)} className="shrink-0 text-[11px]">
                    {ROADMAP_STATUS_LABELS[item.status]}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-4 text-sm text-muted-foreground">
          This is the public plan. How the desk works today is in{" "}
          <Link href="/help?guide=getting-started" className="text-primary-text hover:underline">
            Guides → Getting started
          </Link>
          .
        </CardContent>
      </Card>
    </PageShell>
  );
}
