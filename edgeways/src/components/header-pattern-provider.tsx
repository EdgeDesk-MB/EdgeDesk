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

function initialHeaderPattern(): HeaderPatternId {
  if (typeof window === "undefined" || hasPublicDemoCookieInDocument()) {
    return DEFAULT_HEADER_PATTERN;
  }
  return readStoredHeaderPattern();
}

export function HeaderPatternProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [patternId, setPatternIdState] =
    useState<HeaderPatternId>(initialHeaderPattern);

  useEffect(() => {
    const demo = hasPublicDemoCookieInDocument();
    const next = demo ? DEFAULT_HEADER_PATTERN : readStoredHeaderPattern();
    applyHeaderPattern(next);
    if (!demo) writeStoredHeaderPattern(next);
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
