"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Calculator, ChevronDown, Gift, Map, NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { FilterPill } from "@/components/ui/filter-pill";
import { Input } from "@/components/ui/input";
import { FootballIcon, HorseRacingIcon } from "@/components/sport-icon";
import {
  ROADMAP_CATEGORIES,
  ROADMAP_STATUS_LABELS,
  ROADMAP_VERSION,
  roadmapStats,
  type RoadmapCategory,
  type RoadmapStatus,
} from "@/content/roadmap";
import { deskInsetX } from "@/lib/ui/layout-spacing";
import {
  filterPillCountState,
  filterPillGroup,
  fixtureTapeSectionBar,
  fixtureTapeSectionBody,
  fixtureTapeSectionHover,
  listRow,
  listRowGroup,
  sectionDescription,
  sectionTitle,
  surfaceLift,
} from "@/lib/ui/surface-styles";
import { roadmapStatusBadgeVariant } from "@/lib/ui/status-badges";
import { cn } from "@/lib/utils";

type StatusTab = RoadmapStatus | "all";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "done", label: ROADMAP_STATUS_LABELS.done },
  { id: "in_progress", label: ROADMAP_STATUS_LABELS.in_progress },
  { id: "planned", label: ROADMAP_STATUS_LABELS.planned },
  { id: "future", label: ROADMAP_STATUS_LABELS.future },
];

const STATUS_RANK: Record<RoadmapStatus, number> = {
  in_progress: 0,
  planned: 1,
  future: 2,
  done: 3,
};

function RoadmapCategoryIcon({ id }: { id: string }) {
  const iconClass = "size-4 text-muted-foreground";
  switch (id) {
    case "calculators":
      return <Calculator className={iconClass} />;
    case "racing":
      return <HorseRacingIcon size={16} className={iconClass} />;
    case "football":
      return <FootballIcon size={16} className={iconClass} />;
    case "offers":
      return <Gift className={iconClass} />;
    case "tracker":
      return <NotebookPen className={iconClass} />;
    case "getting-started":
      return <BookOpen className={iconClass} />;
    default:
      return <Map className={iconClass} />;
  }
}

function RoadmapCategoryPlate({ category }: { category: RoadmapCategory }) {
  const [open, setOpen] = useState(true);
  const headingId = `roadmap-${category.id}`;
  const count = category.items.length;

  const toggle = () => setOpen((v) => !v);

  return (
    <section className={cn(surfaceLift, "overflow-hidden rounded-lg")}>
      <div
        className={cn(
          fixtureTapeSectionBar,
          fixtureTapeSectionHover,
          "grid grid-cols-[auto_minmax(0,1fr)_2rem] items-center"
        )}
      >
        <div className="pr-2">
          <span className="flex size-8 items-center justify-center" aria-hidden>
            <RoadmapCategoryIcon id={category.id} />
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${headingId}-list`}
          className="min-w-0 flex-1 cursor-pointer py-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
            <span id={headingId} className={cn(sectionTitle, "flex min-w-0 items-center gap-1.5")}>
            <span className="min-w-0 text-pretty break-words">{category.title}</span>
            {!open ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Collapse" : `Expand, ${count} items`}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center justify-self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <div className={fixtureTapeSectionBody}>
          <ul id={`${headingId}-list`} aria-labelledby={headingId} className={listRowGroup}>
            {category.items.map((item) => (
              <li
                key={item.id}
                id={`roadmap-${item.id}`}
                  className={cn(
                    listRow,
                    deskInsetX,
                    "scroll-mt-24 flex items-start justify-between gap-3 py-4"
                  )}
              >
                <div className="min-w-0">
                  <p className="text-pretty break-words text-base font-medium leading-snug">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className={cn(sectionDescription, "mt-0.5", "text-sm")}>
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={roadmapStatusBadgeVariant(item.status)}
                  className="shrink-0"
                >
                  {ROADMAP_STATUS_LABELS[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function RoadmapPage() {
  const stats = roadmapStats();
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const counts: Record<StatusTab, number> = {
    all: stats.total,
    done: stats.done,
    in_progress: stats.inProgress,
    planned: stats.planned,
    future: stats.future,
  };

  const filteredCategories = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return ROADMAP_CATEGORIES.map((cat) => {
      const categoryHit = Boolean(q && cat.title.toLowerCase().includes(q));
      const items = cat.items
        .filter((item) => {
          const statusOk = statusFilter === "all" || item.status === statusFilter;
          if (!statusOk) return false;
          if (!q || categoryHit) return true;
          return (
            item.title.toLowerCase().includes(q) ||
            (item.description?.toLowerCase().includes(q) ?? false)
          );
        })
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
      return { ...cat, items };
    }).filter((cat) => cat.items.length > 0);
  }, [statusFilter, searchTerm]);

  const filterActive = statusFilter !== "all" || searchTerm.trim().length > 0;

  return (
    <PageShell>
      <PageHeader
        title="Roadmap"
        description="We're currently in beta"
        icon={Map}
        rule={false}
        toolbarRule={false}
        toolbar={
          <>
            <div
              className={cn(filterPillGroup, "min-w-0 max-w-full")}
              role="tablist"
              aria-label="Roadmap status"
            >
              {STATUS_TABS.map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <FilterPill
                    key={tab.id}
                    active={active}
                    hasCount
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    {tab.label}
                    <span className={filterPillCountState(active)}>{counts[tab.id]}</span>
                  </FilterPill>
                );
              })}
            </div>
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search roadmap"
              aria-label="Search roadmap"
              className="min-w-0 w-full sm:ml-auto sm:w-56"
            />
          </>
        }
      />



      {filteredCategories.length > 0 ? (
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <RoadmapCategoryPlate key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Map}
          title="No matching items"
          description="Nothing on the plan matches this status or search."
          action={
            filterActive
              ? {
                  label: "Show all",
                  onClick: () => {
                    setStatusFilter("all");
                    setSearchTerm("");
                  },
                }
              : undefined
          }
        />
      )}

      <p className="text-sm text-muted-foreground">
        This is the public plan. How the desk works today is in{" "}
        <Link href="/help?guide=getting-started" className="text-primary-text hover:underline">
          Guides → Getting started
        </Link>
        .
      </p>
    </PageShell>
  );
}
