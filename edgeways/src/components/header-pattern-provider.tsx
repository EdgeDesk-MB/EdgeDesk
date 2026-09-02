"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyHeaderPattern,
  DEFAULT_HEADER_PATTERN,
  normalizeHeaderPattern,
  readStoredHeaderPattern,
  writeStoredHeaderPattern,
  type HeaderPatternId,
} from "@/lib/header-pattern";
import { hasPublicDemoCookieInDocument } from "@/lib/demo/public-demo";

type HeaderPatternContextValue = {
  patternId: HeaderPatternId;
  setPatternId: (id: HeaderPatternId) => void;
  /** Sync from AppSettings (SQLite) when it arrives. */
  syncFromSettings: (patternId: string | undefined) => void;
};

const HeaderPatternContext = createContext<HeaderPatternContextValue | null>(
  null
);

export function HeaderPatternProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Default on first paint so SSR HTML matches the client. FOUC scripts already
  // applied the stored pattern on <html>; sync React state after mount.
  const [patternId, setPatternIdState] =
    useState<HeaderPatternId>(DEFAULT_HEADER_PATTERN);

  useEffect(() => {
    const demo = hasPublicDemoCookieInDocument();
    const next = demo ? DEFAULT_HEADER_PATTERN : readStoredHeaderPattern();
    applyHeaderPattern(next);
    if (!demo) writeStoredHeaderPattern(next);
    setPatternIdState((prev) => (prev === next ? prev : next));
  }, []);

  const setPatternId = useCallback((id: HeaderPatternId) => {
    const resolved = normalizeHeaderPattern(id);
    if (!hasPublicDemoCookieInDocument()) {
      writeStoredHeaderPattern(resolved);
    }
    applyHeaderPattern(resolved);
    setPatternIdState(resolved);
  }, []);

  const syncFromSettings = useCallback((raw: string | undefined) => {
    if (raw == null || raw === "") return;
    const resolved = normalizeHeaderPattern(raw);
    applyHeaderPattern(resolved);
    if (!hasPublicDemoCookieInDocument()) {
      writeStoredHeaderPattern(resolved);
    }
    setPatternIdState(resolved);
  }, []);

  const value = useMemo(
    () => ({ patternId, setPatternId, syncFromSettings }),
    [patternId, setPatternId, syncFromSettings]
  );

  return (
    <HeaderPatternContext.Provider value={value}>
      {children}
    </HeaderPatternContext.Provider>
  );
}

export function useHeaderPattern(): HeaderPatternContextValue {
  const ctx = useContext(HeaderPatternContext);
  if (!ctx) {
    throw new Error(
      "useHeaderPattern must be used within HeaderPatternProvider"
    );
  }
  return ctx;
}
