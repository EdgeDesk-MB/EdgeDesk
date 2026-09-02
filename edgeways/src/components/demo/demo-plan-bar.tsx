"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { planCheckoutHref, PUBLIC_PLANS } from "@/lib/billing/public-offer";
import {
  assignLiveDesk,
  parsePublicDemoView,
  publicDemoBarLine,
  publicDemoPlansHref,
  signedInDemoCtaForStatus,
  type PublicDemoView,
} from "@/lib/demo/public-demo";
import { useLiveDeskStarted } from "@/components/demo/use-live-desk-started";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import {
  appNavInset,
  appShellGap,
  appShellMaxWidth,
} from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

const EDGE_SEGMENT = cn(
  "group-data-[variant=segmented]/tabs-list:data-active:text-edge-foreground",
  "group-data-[variant=segmented]/tabs-list:data-active:hover:text-edge-foreground",
  "group-data-[variant=segmented]/tabs-list:data-active:active:text-edge-foreground",
  "group-data-[variant=segmented]/tabs-list:data-active:focus-visible:text-edge-foreground",
  "group-data-[variant=segmented]/tabs-list:data-active:[&_svg]:text-edge-foreground",
  "group-data-[variant=segmented]/tabs-list:focus-visible:ring-edge/60"
);

const FREE_SEGMENT = cn(
  "group-data-[variant=segmented]/tabs-list:data-active:text-background",
  "group-data-[variant=segmented]/tabs-list:data-active:hover:text-background",
  "group-data-[variant=segmented]/tabs-list:data-active:active:text-background"
);

function chooseButton(view: PublicDemoView) {
  const plan = PUBLIC_PLANS.find((row) => row.id === view);
  if (!plan) return null;
  const href = planCheckoutHref(plan, "month");
  if (view === "edge") {
    return (
      <Button
        size="lg"
        variant="edge"
        onClick={() => {
          window.location.assign(href);
        }}
      >
        {plan.cta}
      </Button>
    );
  }
  if (view === "core") {
    return (
      <Button
        size="lg"
        className="bg-brand text-brand-foreground hover:bg-brand hover:opacity-90 dark:bg-brand dark:text-brand-foreground dark:hover:bg-brand"
        onClick={() => {
          window.location.assign(href);
        }}
      >
        {plan.cta}
      </Button>
    );
  }
  return (
    <Button
      size="lg"
      variant="outline"
      onClick={() => {
        window.location.assign(href);
      }}
    >
      {plan.cta}
    </Button>
  );
}

function setDemoBarHeight(px: number) {
  const next = `${Math.round(px)}px`;
  if (document.documentElement.style.getPropertyValue("--layout-demo-bar-h") === next) {
    return;
  }
  document.documentElement.style.setProperty("--layout-demo-bar-h", next);
}

export function DemoPlanBar() {
  const { active, view, setView } = usePublicDemo();
  const { isLoaded, isSignedIn } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  const live = useLiveDeskStarted(Boolean(mounted && isLoaded && isSignedIn));
  const signedInCta = signedInDemoCtaForStatus(live.status, live.started);
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!active) {
      setDemoBarHeight(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    const apply = () => setDemoBarHeight(el.getBoundingClientRect().height);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setDemoBarHeight(0);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div ref={barRef} className="shrink-0 border-b border-border bg-canvas py-4 sm:py-3">
      <div
        className={cn(
          "flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2",
          appShellGap,
          "px-0 sm:px-[var(--layout-page-x)]",
          appShellMaxWidth
        )}
      >
        <div className={cn("flex min-w-0 flex-col gap-2", appNavInset)}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-foreground">Viewing</p>
            <Tabs
              value={view}
              onValueChange={(next) => setView(parsePublicDemoView(next))}
              activationMode="manual"
              className="w-fit"
            >
              <TabsList variant="segmented" size="sm" aria-label="Plan to view" fadeClassName="from-canvas">
                <TabsTrigger value="free" data-plate="ink" className={FREE_SEGMENT}>
                  Free
                </TabsTrigger>
                <TabsTrigger value="core">Core</TabsTrigger>
                <TabsTrigger value="edge" data-plate="edge" className={EDGE_SEGMENT}>
                  Edge
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-xs text-muted-foreground">
            {publicDemoBarLine(view)}
            {"  "}
            <Link
              href={publicDemoPlansHref()}
              className="font-medium text-primary-text underline-offset-2 hover:underline"
            >
              View plans
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 pr-6 sm:pl-0">
          {!mounted || !isLoaded || (isSignedIn && !signedInCta) ? (
            <Button size="lg" disabled aria-busy="true">
              Back to your desk
            </Button>
          ) : isSignedIn && signedInCta ? (
            <Button size="lg" onClick={() => assignLiveDesk(signedInCta.path)}>
              {signedInCta.label}
            </Button>
          ) : (
            chooseButton(view)
          )}
        </div>
      </div>
    </div>
  );
}
