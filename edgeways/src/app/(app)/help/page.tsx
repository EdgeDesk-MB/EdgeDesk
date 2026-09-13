"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { PageHeader } from "@/components/help/page-header";
import { HelpGuideContent } from "@/components/help/help-guide-content";
import { SiteMapView } from "@/components/help/site-map";
import { PageLoading } from "@/components/page-loading";
import { PageShell } from "@/components/page-shell";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  DEFAULT_HELP_GUIDE,
  HELP_GUIDE_BY_SLUG,
  HELP_GUIDE_NAV,
  type HelpGuideSlug,
} from "@/content/help/guides";
import { cn } from "@/lib/utils";
import {
  listRowSelected,
  sectionDescription,
  sectionNestedTitle,
  surfaceLift,
} from "@/lib/ui/surface-styles";
import { BookOpen, Mail, Map, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboarding } from "@/components/help/onboarding-provider";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { LEGAL_PATHS } from "@/lib/legal/public";
import { SUPPORT_EMAIL, mailtoHref } from "@/lib/marketing/site-contacts";

function isValidGuide(slug: string | null): slug is HelpGuideSlug {
  return slug != null && slug in HELP_GUIDE_BY_SLUG;
}

function HelpGuideSelect({
  value,
  onChange,
}: {
  value: HelpGuideSlug;
  onChange: (slug: HelpGuideSlug) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isValidGuide(next)) onChange(next);
      }}
    >
      <SelectTrigger className="w-full" aria-label="Choose a guide">
        <SelectValue />
      </SelectTrigger>
      <SelectContent matchTrigger>
        {HELP_GUIDE_NAV.map((guide) => (
          <SelectItem key={guide.slug} value={guide.slug}>
            {guide.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HelpTextLink({
  href,
  children,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-text",
    "underline-offset-2 hover:underline",
    "outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "text-left")}>
        {children}
      </button>
    );
  }

  if (href?.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href ?? "#"} className={className}>
      {children}
    </Link>
  );
}

function HelpQuickLinks({
  resetAndOpenWelcome,
}: {
  resetAndOpenWelcome: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <HelpTextLink href="/roadmap">
        <Map className="size-3.5" aria-hidden />
        Roadmap
      </HelpTextLink>
      <HelpTextLink onClick={resetAndOpenWelcome}>
        <RotateCcw className="size-3.5" aria-hidden />
        Replay welcome tour
      </HelpTextLink>
    </div>
  );
}

function HelpSupportCopy() {
  return (
    <p className={cn(sectionDescription, "mb-4")}>
      Feedback is for bugs, ideas and direct notes. Email is for account and billing. We aim to
      reply within two working days.
    </p>
  );
}

function HelpLegalLinks() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <HelpTextLink href={LEGAL_PATHS.contact}>Contact</HelpTextLink>
      <span className="text-sm text-muted-foreground" aria-hidden>
        ·
      </span>
      <HelpTextLink href={LEGAL_PATHS.refund}>Refunds</HelpTextLink>
    </p>
  );
}

function HelpSupportBlock({
  resetAndOpenWelcome,
  actions,
}: {
  resetAndOpenWelcome: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <HelpQuickLinks resetAndOpenWelcome={resetAndOpenWelcome} />
      <div className="flex flex-col gap-2">
        <hr className="border-border/60 my-3" />
        <div>
          <p className={sectionNestedTitle}>Support</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Feedback is for bugs, ideas and direct notes. Email is for account and billing. We aim to
            reply within two working days.
          </p>
        </div>
        <hr className="border-border/60 my-3" />
        <div className="pt-2">
          {actions}
        </div>
        <hr className="border-border/60 my-3" />
        <HelpLegalLinks />
      </div>
    </div>
  );
}

function HelpPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resetAndOpenWelcome } = useOnboarding();

  const guideParam = searchParams?.get("guide") ?? null;
  const activeSlug = isValidGuide(guideParam) ? guideParam : DEFAULT_HELP_GUIDE;
  const activeGuide = HELP_GUIDE_BY_SLUG[activeSlug];

  const setGuide = useCallback(
    (slug: HelpGuideSlug) => {
      router.replace(`/help?guide=${slug}`, { scroll: false });
    },
    [router]
  );

  return (
    <PageShell>
      <PageHeader title="Guides" description="How to use the desk." icon={BookOpen} />

      <div className="grid min-w-0 gap-[var(--layout-stack-gap)] lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Guides"
          className={cn(
            surfaceLift,
            "hidden self-start rounded-xl lg:sticky lg:top-0 lg:flex lg:max-h-[var(--layout-page-min-h)] lg:flex-col"
          )}
        >
          <ScrollFadeEdges
            className="min-h-0 flex-1"
            fadeClassName="from-card"
            scrollClassName="app-scroll-nested p-2"
          >
            <div className="flex flex-col gap-0.5">
              {HELP_GUIDE_NAV.map((guide) => {
                const active = activeSlug === guide.slug;
                return (
                  <Link
                    key={guide.slug}
                    href={`/help?guide=${guide.slug}`}
                    replace
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      listRowSelected(active),
                      "min-w-0 px-3 py-2 text-sm font-medium outline-none",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    )}
                  >
                    <span className="text-pretty break-words">{guide.title}</span>
                  </Link>
                );
              })}
            </div>
          </ScrollFadeEdges>
          <div className="shrink-0 border-t border-border/60 px-5 py-6">
            <HelpSupportBlock
              resetAndOpenWelcome={resetAndOpenWelcome}
              actions={
                <>
                  <HelpTextLink href="/feedback">
                    <MessageSquarePlus className="size-3.5" aria-hidden />
                    Send feedback
                  </HelpTextLink>
                  <HelpTextLink href={mailtoHref(SUPPORT_EMAIL)}>
                    <Mail className="size-3.5" aria-hidden />
                    {SUPPORT_EMAIL}
                  </HelpTextLink>
                </>
              }
            />
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-[var(--layout-stack-gap-compact)] lg:gap-[var(--layout-stack-gap)]">
          <div className="lg:hidden">
            <HelpGuideSelect value={activeSlug} onChange={setGuide} />
          </div>
          <Card>
            <CardHeader>
              <h2 className="font-heading text-pretty break-words text-base font-bold leading-snug">
                {activeGuide.title}
              </h2>
              <CardDescription>{activeGuide.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSlug === "site-map" ? (
                <SiteMapView />
              ) : (
                <HelpGuideContent guide={activeGuide} />
              )}
            </CardContent>
          </Card>

          <div className="border-t border-border/60 pt-4 lg:hidden">
            <HelpSupportBlock
              resetAndOpenWelcome={resetAndOpenWelcome}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button asChild {...pagePrimaryButtonProps}>
                    <Link href="/feedback">
                      <MessageSquarePlus className="size-4" /> Send feedback
                    </Link>
                  </Button>
                  <Button asChild variant="outline" {...pageSecondaryButtonProps}>
                    <a href={mailtoHref(SUPPORT_EMAIL)}>
                      <Mail className="size-4" /> {SUPPORT_EMAIL}
                    </a>
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading help" />}>
      <HelpPageContent />
    </Suspense>
  );
}
