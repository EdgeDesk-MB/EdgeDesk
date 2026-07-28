"use client";

/**
 * Live site map - rendered straight from NAV_SECTIONS, so it always shows
 * the navigation as it actually is. Built for reviewing structure (which
 * pages could become sub-nav groups like Offers → Calendar / Campaigns).
 */

import Link from "next/link";
import { CornerDownRight, ExternalLink, Plus, Radio } from "lucide-react";
import { NAV_SECTIONS } from "@/components/app-nav";
import { captionHeading } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Pages that exist but sit outside the main navigation. */
const OFF_NAV_PAGES: Array<{ href: string; label: string; note: string }> = [
  { href: "/settings", label: "Settings", note: "burger menu" },
  { href: "/release-notes", label: "Release notes", note: "burger menu" },
  { href: "/help", label: "Help", note: "burger menu" },
  { href: "/roadmap", label: "Roadmap", note: "linked from Help and Settings" },
  { href: "/balances", label: "Balances", note: "legacy redirect → Accounts" },
  { href: "/events", label: "Events", note: "legacy redirect → Fixtures" },
];

/**
 * Structural observations for review - editorial, not live data. Dated so
 * stale opinions are obvious; prune once acted on or rejected.
 */
const OBSERVATIONS: Array<{ title: string; detail: string }> = [
  {
    title: "Tracked Events + Fixtures are one workflow",
    detail:
      "Fixtures is browse-to-track; Tracked Events is what you tracked. The strongest candidate for an Offers-style group: Events → Tracked / Fixtures, one sidebar row instead of two.",
  },
  {
    title: "2UP Desk's route contradicts its home",
    detail:
      "It sits under Live desks but lives at /calculators/ep-desk, which also forces a special case in the active-state logic. A /2up route (old path redirecting) would make the URL match the navigation.",
  },
  {
    title: "Profit Tracker hides two views behind query params",
    detail:
      "The monthly P&L tab (?tab=pnl) and the settle queue (?queue=settle) are destinations in their own right. If they keep growing, Tracker → Bets / P&L is a natural sub-nav.",
  },
  {
    title: "Insight is a single-item section",
    detail:
      "Sections earn their keep at two or more entries. Fine if the Edge Report is expected to gain siblings; otherwise it could rejoin the top section and the heading retires.",
  },
  {
    title: "The mobile drawer drops the sidebar's badges",
    detail:
      "The sidebar shows the offers action count and the settle-queue badge; the drawer only carries Alerts. A deliberate simplification for now - worth revisiting if mobile becomes the primary way in.",
  },
  {
    title: "Roadmap has no menu home",
    detail:
      "It is only reachable via Help and Settings. If it is consulted often, it could join the burger utilities; if not, that is fine as-is.",
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function PageRow({
  href,
  label,
  indent = false,
  chips,
}: {
  href: string;
  label: string;
  indent?: boolean;
  chips?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-2 py-1", indent && "pl-6")}>
      {indent ? (
        <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      ) : null}
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        {label}
        <ExternalLink className="size-3 shrink-0" aria-hidden />
      </Link>
      <code className="rounded bg-muted px-1 text-[11px] text-muted-foreground">{href}</code>
      {chips}
    </div>
  );
}

export function SiteMapView() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Rendered live from the navigation structure, so this page is always current. Groups show
        their sub-navigation indented - the pattern to copy when a page grows sub-pages of its
        own (as Offers and Casino already have).
      </p>

      {NAV_SECTIONS.map((section) => (
        <div key={section.label ?? "top"}>
          <p className={cn(captionHeading, "pb-1")}>{section.label ?? "Top level"}</p>
          <div className="flex flex-col">
            {section.entries.map((entry) =>
              entry.kind === "link" ? (
                <PageRow
                  key={entry.href}
                  href={entry.href}
                  label={entry.label}
                  chips={
                    <>
                      {entry.quickAction ? (
                        <Chip>
                          <Plus className="size-2.5" aria-hidden /> quick action
                        </Chip>
                      ) : null}
                      {entry.livePulse ? (
                        <Chip>
                          <Radio className="size-2.5" aria-hidden /> live pulse
                        </Chip>
                      ) : null}
                    </>
                  }
                />
              ) : (
                <div key={entry.baseHref}>
                  <PageRow
                    href={entry.href}
                    label={entry.label}
                    chips={<Chip>group · sub-nav</Chip>}
                  />
                  {entry.children.map((child) => (
                    <PageRow key={child.href} href={child.href} label={child.label} indent />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      ))}

      <div>
        <p className={cn(captionHeading, "pb-1")}>Outside the main navigation</p>
        <div className="flex flex-col">
          {OFF_NAV_PAGES.map((page) => (
            <PageRow
              key={page.href}
              href={page.href}
              label={page.label}
              chips={<Chip>{page.note}</Chip>}
            />
          ))}
        </div>
      </div>

      <div className="rounded-md border border-dashed p-4">
        <p className={cn(captionHeading, "pb-2")}>Tidy-up observations · 14 Jul 2026</p>
        <ul className="flex flex-col gap-3">
          {OBSERVATIONS.map((obs) => (
            <li key={obs.title} className="text-sm">
              <span className="font-medium">{obs.title}.</span>{" "}
              <span className="text-muted-foreground">{obs.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Editorial, not live data - prune each item once acted on or rejected.
        </p>
      </div>
    </div>
  );
}
