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
  HELP_GUIDES,
  HELP_GUIDE_BY_SLUG,
  type HelpGuideSlug,
} from "@/content/help/guides";
import { cn } from "@/lib/utils";
import { listRowSelected } from "@/lib/ui/surface-styles";
import { BookOpen, Map, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboarding } from "@/components/help/onboarding-provider";

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
        title="Help"
        description="Guides, FAQs and tips for getting the most from Edgeways."
        icon={BookOpen}
      />

      <div className="grid gap-[var(--layout-stack-gap)] lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle section>Guides</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 pt-0">
              {HELP_GUIDES.map((guide) => (
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
            <CardHeader>
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

          <Card className="mt-4 border-dashed">
            <CardContent className="py-4 text-sm text-muted-foreground">
              <p>
                Need more detail on API tiers? See{" "}
                <code className="rounded bg-muted px-1 text-xs">docs/api-dependencies-and-tiers.md</code>{" "}
                in the project folder, or check Settings → Data &amp; API for live connection status.
              </p>
              <p className="mt-2">
                Support channel coming in v1.0. For now, use the Roadmap page to see what&apos;s
                shipping and what&apos;s planned.
              </p>
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
