"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  APP_UPDATE_CHANGE_EVENT,
  DEFAULT_APP_UPDATE,
  DEFAULT_APP_UPDATE_LINK_LABEL,
  appUpdateExitHold,
  appUpdateIsVisible,
  appUpdatesEqual,
  normalizeAppUpdate,
  readAppUpdateFromUnknown,
  readBuildStampFromUnknown,
  shouldApplyDeskUpdateNow,
  type AppUpdateSettings,
} from "@/lib/admin/app-update-shared";
import {
  SITE_BANNER_CHANGE_EVENT,
  SITE_BANNER_POLL_MS,
  normalizeMaintenanceBanner,
  siteBannerExitHold,
  siteBannerIsVisible,
  siteBannersEqual,
  type MaintenanceBanner,
} from "@/lib/admin/maintenance-banner-shared";
import { SPRING_DURATION_MS } from "@/lib/ui/motion";
import { MaintenanceBannerView } from "./maintenance-banner";
import { SiteBannerSlot } from "./site-banner-slot";

const LAYOUT_TOKEN = "--layout-site-banner-h";

function setSiteBannerHeight(px: number) {
  const next = px < 0.5 ? 0 : px;
  document.documentElement.style.setProperty(LAYOUT_TOKEN, `${next}px`);
}

function readBannerFromUnknown(raw: unknown): MaintenanceBanner {
  return normalizeMaintenanceBanner(
    raw && typeof raw === "object" ? (raw as Partial<MaintenanceBanner>) : null
  );
}

async function reloadDesk(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    }
  } catch {
    // Reload still picks up the new documents.
  }
  window.location.reload();
}

/**
 * Live site chrome: operator banner plus an optional update prompt.
 * SSR first paint when already on, then poll so open tabs animate in
 * or out without a reload. Fail-soft. A same-tab publish beats an
 * in-flight poll.
 */
export function MaintenanceBannerLive({
  initial,
  initialUpdate = DEFAULT_APP_UPDATE,
  buildStamp = null,
}: {
  initial: MaintenanceBanner | null;
  initialUpdate?: AppUpdateSettings | null;
  buildStamp?: string | null;
}) {
  const start = normalizeMaintenanceBanner(initial);
  const startUpdate = normalizeAppUpdate(initialUpdate);
  const bootStampRef = useRef(buildStamp);
  const [live, setLive] = useState(start);
  const [liveUpdate, setLiveUpdate] = useState(startUpdate);
  const [liveStamp, setLiveStamp] = useState(buildStamp);
  const [held, setHeld] = useState<MaintenanceBanner | null>(
    siteBannerIsVisible(start) ? start : null
  );
  const [heldUpdate, setHeldUpdate] = useState<AppUpdateSettings | null>(
    appUpdateIsVisible(startUpdate, bootStampRef.current, buildStamp)
      ? startUpdate
      : null
  );
  const [motionReady, setMotionReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bannerVisible = siteBannerIsVisible(live);
  const updateVisible = appUpdateIsVisible(
    liveUpdate,
    bootStampRef.current,
    liveStamp
  );
  const shownBanner = bannerVisible ? live : held;
  const shownUpdate = updateVisible ? liveUpdate : heldUpdate;

  useEffect(() => {
    const id = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setHeld((prev) => siteBannerExitHold(prev, live));
  }, [live]);

  useEffect(() => {
    setHeldUpdate((prev) =>
      appUpdateExitHold(prev, liveUpdate, bootStampRef.current, liveStamp)
    );
  }, [liveUpdate, liveStamp]);

  useEffect(() => {
    if (bannerVisible || !held) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce || !motionReady ? 0 : SPRING_DURATION_MS;
    const id = window.setTimeout(() => {
      setHeld((prev) => (siteBannerIsVisible(live) ? prev : null));
    }, ms);
    return () => window.clearTimeout(id);
  }, [bannerVisible, held, live, motionReady]);

  useEffect(() => {
    if (updateVisible || !heldUpdate) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduce || !motionReady ? 0 : SPRING_DURATION_MS;
    const id = window.setTimeout(() => {
      setHeldUpdate((prev) =>
        appUpdateIsVisible(liveUpdate, bootStampRef.current, liveStamp)
          ? prev
          : null
      );
    }, ms);
    return () => window.clearTimeout(id);
  }, [updateVisible, heldUpdate, liveUpdate, liveStamp, motionReady]);

  useEffect(() => {
    if (!updateVisible) return;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      if (
        !shouldApplyDeskUpdateNow(
          liveUpdate,
          bootStampRef.current,
          liveStamp,
          document
        )
      ) {
        return;
      }
      cancelled = true;
      void reloadDesk();
    };
    const kick = window.setTimeout(apply, 1_200);
    const id = window.setInterval(apply, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [liveStamp, liveUpdate, updateVisible]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let gen = 0;

    function applyBanner(next: MaintenanceBanner) {
      setLive((prev) => (siteBannersEqual(prev, next) ? prev : next));
    }

    function applyUpdate(next: AppUpdateSettings) {
      setLiveUpdate((prev) => (appUpdatesEqual(prev, next) ? prev : next));
    }

    function applyStamp(next: string | null) {
      setLiveStamp((prev) => (prev === next ? prev : next));
    }

    async function tick() {
      if (cancelled || document.hidden) return;
      const started = gen;
      try {
        const res = await fetch("/api/maintenance", { credentials: "same-origin" });
        if (!res.ok || cancelled || started !== gen) return;
        const raw: unknown = await res.json();
        applyBanner(readBannerFromUnknown(raw));
        applyUpdate(readAppUpdateFromUnknown(raw));
        applyStamp(readBuildStampFromUnknown(raw));
      } catch {
        // Best-effort. The next tick retries.
      }
    }

    function schedule() {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void tick().then(schedule);
      }, SITE_BANNER_POLL_MS);
    }

    function onVisibility() {
      if (!document.hidden) void tick();
    }

    function onAnnounce(event: Event) {
      gen += 1;
      applyBanner(readBannerFromUnknown((event as CustomEvent<unknown>).detail));
    }

    function onUpdateAnnounce(event: Event) {
      gen += 1;
      applyUpdate(
        normalizeAppUpdate((event as CustomEvent<AppUpdateSettings>).detail)
      );
    }

    void tick().then(schedule);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(SITE_BANNER_CHANGE_EVENT, onAnnounce);
    window.addEventListener(APP_UPDATE_CHANGE_EVENT, onUpdateAnnounce);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(SITE_BANNER_CHANGE_EVENT, onAnnounce);
      window.removeEventListener(APP_UPDATE_CHANGE_EVENT, onUpdateAnnounce);
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      setSiteBannerHeight(0);
      return;
    }

    let raf = 0;
    let tracking = false;

    const apply = () => {
      setSiteBannerHeight(el.getBoundingClientRect().height);
    };

    const stopTracking = () => {
      tracking = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      apply();
    };

    const isHeightTransition = (event: Event) =>
      event instanceof TransitionEvent && event.propertyName === "grid-template-rows";

    const startTracking = (event: Event) => {
      if (!isHeightTransition(event) || tracking) return;
      tracking = true;
      const step = () => {
        apply();
        if (tracking) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const endTracking = (event: Event) => {
      if (!isHeightTransition(event)) return;
      stopTracking();
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    el.addEventListener("transitionrun", startTracking);
    el.addEventListener("transitionend", endTracking);
    el.addEventListener("transitioncancel", endTracking);
    return () => {
      observer.disconnect();
      el.removeEventListener("transitionrun", startTracking);
      el.removeEventListener("transitionend", endTracking);
      el.removeEventListener("transitioncancel", endTracking);
      stopTracking();
      setSiteBannerHeight(0);
    };
  }, []);

  const announceParts = [
    updateVisible ? liveUpdate.message : "",
    bannerVisible ? live.message : "",
  ].filter(Boolean);

  return (
    <div className="relative min-w-0 shrink-0">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announceParts.join(" ")}
      </p>
      <div ref={wrapRef} className="min-w-0">
        <SiteBannerSlot visible={updateVisible} motionReady={motionReady}>
          {shownUpdate ? (
            <MaintenanceBannerView
              message={shownUpdate.message}
              kind="notice"
              action={{
                label: DEFAULT_APP_UPDATE_LINK_LABEL,
                onClick: () => {
                  void reloadDesk();
                },
              }}
              announce={false}
            />
          ) : null}
        </SiteBannerSlot>
        {(updateVisible || heldUpdate) && (bannerVisible || held) ? (
          <div className="h-px bg-canvas" aria-hidden />
        ) : null}
        <SiteBannerSlot visible={bannerVisible} motionReady={motionReady}>
          {shownBanner ? (
            <MaintenanceBannerView
              message={shownBanner.message}
              kind={shownBanner.kind}
              href={shownBanner.href}
              linkLabel={shownBanner.linkLabel}
              announce={false}
            />
          ) : null}
        </SiteBannerSlot>
      </div>
    </div>
  );
}
