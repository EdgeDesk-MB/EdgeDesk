"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { PageHeader } from "@/components/help/page-header";
import { HelpGuideContent } from "@/components/help/help-guide-content";
import { SiteMapView } from "@/components/help/site-map";
import { PageShell } from "@/components/page-shell";
import {
  DEFAULT_HELP_GUIDE,
  HELP_GUIDE_BY_SLUG,
  HELP_GUIDE_NAV,
  type HelpGuideSlug,
} from "@/content/help/guides";
import { cn } from "@/lib/utils";
import { listRowSelected } from "@/lib/ui/surface-styles";
import { BookOpen, Mail, Map, MessageCircleQuestion, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function HelpPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resetAndOpenWelcome } = useOnboarding();

  const guideParam = searchParams.get("guide");
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
      <PageHeader
        title="Guides"
        description="How to use the desk."
        icon={BookOpen}
      />

      <div className="grid gap-[var(--layout-stack-gap)] lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle section>Guides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 pt-0">
              {HELP_GUIDE_NAV.map((guide) => (
                <button
                  key={guide.slug}
                  type="button"
                  onClick={() => setGuide(guide.slug)}
                  className={cn(
                    listRowSelected(activeSlug === guide.slug),
                    "w-full px-3 py-2 text-left text-sm"
                  )}
                >
                  <span className="font-medium">{guide.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                    {guide.description}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="mt-[var(--layout-stack-gap)]">
            <CardHeader className="pb-2">
              <CardTitle section>Quick links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Button variant="outline" size="sm" className="justify-start" asChild>
                <Link href="/roadmap">
                  <Map className="size-3.5" /> Roadmap
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={resetAndOpenWelcome}
              >
                <MessageCircleQuestion className="size-3.5" /> Take the tour again
              </Button>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-9">
          <Card>
            <CardHeader className="pb-0 lg:hidden">
              <Tabs
                value={activeSlug}
                onValueChange={(value) => {
                  if (isValidGuide(value)) setGuide(value);
                }}
                className="gap-0"
              >
                <TabsLineBar bleed="card">
                  <TabsList variant="line" className="justify-start">
                    {HELP_GUIDE_NAV.map((guide) => (
                      <TabsTrigger key={guide.slug} value={guide.slug}>
                        {guide.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </TabsLineBar>
              </Tabs>
              <CardDescription className="pt-3">{activeGuide.description}</CardDescription>
            </CardHeader>
            <CardHeader className="hidden lg:grid">
              <CardTitle>{activeGuide.title}</CardTitle>
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

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle section>Support</CardTitle>
              <CardDescription>
                Feedback is for bugs, ideas and direct notes. Email is for account and
                billing. We aim to reply within two working days.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <div className="flex w-full flex-wrap gap-2 lg:hidden">
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <Link href="/roadmap">
                    <Map className="size-3.5" /> Roadmap
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={resetAndOpenWelcome}
                >
                  <MessageCircleQuestion className="size-3.5" /> Take the tour again
                </Button>
              </div>
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
              <Button asChild variant="outline" {...pageSecondaryButtonProps}>
                <Link href={LEGAL_PATHS.contact}>Contact</Link>
              </Button>
              <Button asChild variant="outline" {...pageSecondaryButtonProps}>
                <Link href={LEGAL_PATHS.refund}>Refunds</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading help…</div>}>
      <HelpPageContent />
    </Suspense>
  );
}
