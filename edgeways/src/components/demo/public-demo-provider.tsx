"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  const [view, setViewState] = useState<PublicDemoView>("edge");
  const [forceSetup, setForceSetup] = useState(false);

  useEffect(() => {
    const next = readDemoSearch();
    setViewState(next.view);
    setForceSetup(next.forceSetup);
  }, []);

  const setView = useCallback((next: PublicDemoView) => {
    setViewState(next);
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
