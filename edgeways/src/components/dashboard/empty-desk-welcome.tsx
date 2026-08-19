"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  FileSpreadsheet,
  FileUp,
  Gift,
  Map,
  Palette,
  Plus,
  ScrollText,
  Settings,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PlatformImportDialog } from "@/components/import/platform-import-dialog";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import { useAddBet } from "@/components/add-bet-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useAppState } from "@/hooks/use-app-state";
import { cardBleedX, cardInsetX } from "@/lib/ui/layout-spacing";
import {
  listRow,
  offerCampaignCardInteractive,
  pageTitle,
  panelSurface,
  sectionDescription,
  sectionTitle,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const hubTileClass = cn(
  panelSurface,
  offerCampaignCardInteractive,
  "min-w-0 p-4 pb-6 text-left outline-none",
  "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
);

const welcomeButtonClass = "min-w-[8.75rem] justify-center";

const welcomeRowClass = cn(
  listRow,
  cardInsetX,
  "flex w-full min-w-0 items-start gap-3 py-3.5 text-left outline-none",
  "active:bg-selection-subdued",
  "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-inset"
);

const GET_TO_KNOW = [
  {
    href: "/settings?tab=appearance",
    icon: Palette,
    title: "Make the desk yours",
    body: "Light or dark, font, header pattern, and brand accent live in Settings → Appearance.",
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Review settings",
    body: "Defaults, alerts, Home layout, backups, and billing are all in one place. Worth a slow pass once.",
  },
  {
    href: "/help",
    icon: BookOpen,
    title: "Guides",
    body: "How each area of the desk works, beyond the betting workflow itself.",
  },
  {
    href: "/release-notes",
    icon: ScrollText,
    title: "Release notes",
    body: "Stay on top of what landed. The desk moves; this is the changelog.",
  },
  {
    href: "/roadmap",
    icon: Map,
    title: "Roadmap",
    body: "What is coming next, and what is deliberately not being built yet.",
  },
] as const;

function WelcomeTile({
  icon: Icon,
  title,
  body,
  href,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="size-4 text-primary-text" aria-hidden />
      <span className="mt-2 block text-sm font-semibold">{title}</span>
      <span className={cn(sectionDescription, "mt-1 block")}>{body}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={hubTileClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={hubTileClass}>
      {inner}
    </button>
  );
}

function WelcomeRow({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className={welcomeRowClass}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={cn(sectionDescription, "mt-0.5 block")}>{body}</span>
      </span>
    </Link>
  );
}

/**
 * First-run getting-started hub (EDGE-63). Not an `<EmptyState>`: several
 * next actions, not one content gap. Setup-missing Home still uses EmptyState.
 */
export function EmptyDeskWelcome() {
  const { user } = useUser();
  const { refresh } = useAppState();
  const { openAddBet } = useAddBet();
  const { openOffer } = useOfferDialog();
  const [importOpen, setImportOpen] = useState(false);
  const name = user?.firstName?.trim();

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <div className="min-w-0">
        <h1 className={pageTitle}>
          {name ? `Welcome, ${name}` : "Welcome to the desk"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground text-pretty break-words">
          Great to have you on board. When you are ready, bring history across,
          log a ticket, or add an offer you already have.
        </p>

        <section className="mt-6 min-w-0 border-t border-border/60 pt-6">
          <h3 className={sectionTitle}>Get started</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <WelcomeTile
              icon={FileUp}
              title="Import from Oddsmonkey"
              body="Profits CSV from their tracker. History only. Not affiliated with Oddsmonkey."
              onClick={() => setImportOpen(true)}
            />
            <WelcomeTile
              icon={FileSpreadsheet}
              title="Import a spreadsheet"
              body="Generic CSV from Settings → Data & backup."
              href="/settings?tab=data"
            />
            <WelcomeTile
              icon={Plus}
              title="Log your first bet"
              body="A ticket you already placed."
              onClick={() => openAddBet()}
            />
            <WelcomeTile
              icon={Gift}
              title="Add an offer"
              body="One you already have from a finder or a bookie."
              onClick={() => openOffer()}
            />
          </div>
        </section>

        <section className="mt-6 min-w-0">
          <h3 className={sectionTitle}>Quick links</h3>
          <div className={cn(outlineButtonGroup, "mt-4")}>
            <Button asChild variant="outline" size="lg" className={welcomeButtonClass}>
              <Link href="/offers">
                <Gift className="size-4" />
                Offers
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className={welcomeButtonClass}>
              <Link href="/accounts">
                <Wallet className="size-4" />
                Accounts
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className={welcomeButtonClass}>
              <Link href="/calculators">
                <Calculator className="size-4" />
                Calculators
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6">
          <section className="min-w-0 pb-16">
            <h3 id="welcome-get-to-know" className={sectionTitle}>
              Get to know the desk
            </h3>
            <p className={cn(sectionDescription, "mt-1.5 max-w-3xl")}>
              Matched betting is the work. The rest of Edgeways is how you stay on top of
              it: appearance, backups, what shipped, and what is coming. These are the
              places worth knowing early.
            </p>
            <ul
              aria-labelledby="welcome-get-to-know"
              className={cn(
                cardBleedX,
                "mt-4 list-none border-t border-border/60 p-0 [&>li:last-child>*]:border-b-0"
              )}
            >
              {GET_TO_KNOW.map((item) => (
                <li key={item.href}>
                  <WelcomeRow
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    body={item.body}
                  />
                </li>
              ))}
            </ul>
          </section>
        </CardContent>
        <CardFooter className="w-full items-start">
          <p className="w-full min-w-0 text-xs leading-relaxed text-muted-foreground text-pretty break-words">
            <span className="[font-variant-emoji:emoji]" aria-hidden>
              ⚡
            </span>{" "}
            edgeways is made with love{" "}
            <span
              className="inline-block grayscale contrast-125 [font-variant-emoji:emoji]"
              aria-hidden
            >
              🫶
            </span>{" "}
            by a dedicated team. We are constantly improving. If you have any
            feedback, please use the{" "}
            <Link
              href="/feedback"
              className="font-medium text-primary-text underline-offset-2 hover:underline"
            >
              Feedback form
            </Link>
            .
          </p>
        </CardFooter>
      </Card>

      <PlatformImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void refresh()}
      />
    </div>
  );
}
