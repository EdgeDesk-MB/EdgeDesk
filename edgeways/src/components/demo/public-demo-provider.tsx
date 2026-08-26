"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  hasPublicDemoCookieInDocument,
  parsePublicDemoView,
  type PublicDemoView,
} from "@/lib/demo/public-demo";

type PublicDemoContextValue = {
  active: boolean;
  view: PublicDemoView;
  forceSetup: boolean;
  setView: (view: PublicDemoView) => void;
};

const PublicDemoContext = createContext<PublicDemoContextValue>({
  active: false,
  view: "edge",
  forceSetup: false,
  setView: () => {},
});

export function usePublicDemo(): PublicDemoContextValue {
  return useContext(PublicDemoContext);
}

function readDemoSearch(): { view: PublicDemoView; forceSetup: boolean } {
  if (typeof window === "undefined") {
    return { view: "edge", forceSetup: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    view: parsePublicDemoView(params.get("view")),
    forceSetup: params.get("setup") === "1",
  };
}

const SERVER_DEMO_SEARCH: { view: PublicDemoView; forceSetup: boolean } = {
  view: "edge",
  forceSetup: false,
};

const subscribeNoop = () => () => {};

let demoSearchCache: {
  key: string;
  value: { view: PublicDemoView; forceSetup: boolean };
} | null = null;

function readDemoSearchSnapshot(): { view: PublicDemoView; forceSetup: boolean } {
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
  const [active] = useState(
    () => initialActive || hasPublicDemoCookieInDocument()
  );
  const search = useSyncExternalStore(
    subscribeNoop,
    readDemoSearchSnapshot,
    () => SERVER_DEMO_SEARCH
  );
  const [viewOverride, setViewOverride] = useState<PublicDemoView | null>(null);
  const view = viewOverride ?? search.view;
  const forceSetup = search.forceSetup;

  const setView = useCallback((next: PublicDemoView) => {
    setViewOverride(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const value = useMemo(
    () => ({ active, view, forceSetup, setView }),
    [active, view, forceSetup, setView]
  );

  return (
    <PublicDemoContext.Provider value={value}>{children}</PublicDemoContext.Provider>
  );
}
