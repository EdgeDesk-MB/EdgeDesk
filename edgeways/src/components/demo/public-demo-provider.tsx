"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  hasPublicDemoCookieInDocument,
  publicDemoSearchWithView,
  PUBLIC_DEMO_VIEW_PARAM,
  readPublicDemoViewParam,
  withPublicDemoView,
  type PublicDemoView,
} from "@/lib/demo/public-demo";

type PublicDemoContextValue = {
  active: boolean;
  view: PublicDemoView;
  forceSetup: boolean;
  setView: (view: PublicDemoView) => void;
  /** Internal desk href carrying the plan preview while the demo is active. */
  demoHref: (href: string) => string;
};

const identityHref = (href: string) => href;

const PublicDemoContext = createContext<PublicDemoContextValue>({
  active: false,
  view: "edge",
  forceSetup: false,
  setView: () => {},
  demoHref: identityHref,
});

export function usePublicDemo(): PublicDemoContextValue {
  return useContext(PublicDemoContext);
}

type DemoSearch = { view: PublicDemoView | null; forceSetup: boolean };

function readDemoSearch(): DemoSearch {
  if (typeof window === "undefined") {
    return { view: null, forceSetup: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    view: readPublicDemoViewParam(params.get(PUBLIC_DEMO_VIEW_PARAM)),
    forceSetup: params.get("setup") === "1",
  };
}

const SERVER_DEMO_SEARCH: DemoSearch = { view: null, forceSetup: false };

const subscribeNoop = () => () => {};

let demoSearchCache: { key: string; value: DemoSearch } | null = null;

function readDemoSearchSnapshot(): DemoSearch {
  const key = window.location.search;
  if (demoSearchCache == null || demoSearchCache.key !== key) {
    demoSearchCache = { key, value: readDemoSearch() };
  }
  return demoSearchCache.value;
}

export function PublicDemoProvider({
  children,
  initialActive = false,
}: {
  children: ReactNode;
  initialActive?: boolean;
}) {
  const pathname = usePathname();
  const [active] = useState(
    () => initialActive || hasPublicDemoCookieInDocument()
  );
  const search = useSyncExternalStore(
    subscribeNoop,
    readDemoSearchSnapshot,
    () => SERVER_DEMO_SEARCH
  );
  // A nav link to a bare path drops `?view=`. Keep the last explicit plan so
  // the preview does not fall back to Edge mid-session.
  const [lastView, setLastView] = useState<PublicDemoView | null>(null);
  if (search.view != null && search.view !== lastView) setLastView(search.view);
  // Null until the client has read the URL. The server never sees `?view=`.
  const knownView = search.view ?? lastView;
  const view = knownView ?? "edge";
  const forceSetup = search.forceSetup;

  const setView = useCallback((next: PublicDemoView) => {
    setLastView(next);
    const url = new URL(window.location.href);
    url.searchParams.set(PUBLIC_DEMO_VIEW_PARAM, next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!active) return;
    // On hydration `view` is still the server default, so an explicit plan in
    // the URL wins. `setView` writes the URL itself.
    const current = new URLSearchParams(window.location.search);
    if (readPublicDemoViewParam(current.get(PUBLIC_DEMO_VIEW_PARAM)) != null) return;
    const next = publicDemoSearchWithView(window.location.search, view);
    if (next == null) return;
    const { pathname: path, hash } = window.location;
    window.history.replaceState(null, "", `${path}${next}${hash}`);
  }, [active, pathname, view]);

  const demoHref = useCallback(
    (href: string) =>
      active && knownView != null ? withPublicDemoView(href, knownView) : href,
    [active, knownView]
  );

  const value = useMemo(
    () => ({ active, view, forceSetup, setView, demoHref }),
    [active, view, forceSetup, setView, demoHref]
  );

  return (
    <PublicDemoContext.Provider value={value}>{children}</PublicDemoContext.Provider>
  );
}
