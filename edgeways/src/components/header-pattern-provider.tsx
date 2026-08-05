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
  const [patternId, setPatternIdState] =
    useState<HeaderPatternId>(DEFAULT_HEADER_PATTERN);

  useEffect(() => {
    const stored = readStoredHeaderPattern();
    setPatternIdState(stored);
    applyHeaderPattern(stored);
  }, []);

  const setPatternId = useCallback((id: HeaderPatternId) => {
    const resolved = normalizeHeaderPattern(id);
    writeStoredHeaderPattern(resolved);
    applyHeaderPattern(resolved);
    setPatternIdState(resolved);
  }, []);

  const syncFromSettings = useCallback((raw: string | undefined) => {
    if (raw == null || raw === "") return;
    const resolved = normalizeHeaderPattern(raw);
    setPatternIdState((prev) => {
      if (prev === resolved) return prev;
      applyHeaderPattern(resolved);
      writeStoredHeaderPattern(resolved);
      return resolved;
    });
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
