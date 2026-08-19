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
  applyUiFont,
  DEFAULT_UI_FONT,
  normalizeUiFont,
  readStoredUiFont,
  writeStoredUiFont,
  type UiFontId,
} from "@/lib/ui-font";
import { hasPublicDemoCookieInDocument } from "@/lib/demo/public-demo";

type UiFontContextValue = {
  fontId: UiFontId;
  setFontId: (id: UiFontId) => void;
  /** Sync from AppSettings (SQLite) when it arrives. */
  syncFromSettings: (fontId: string | undefined) => void;
};

const UiFontContext = createContext<UiFontContextValue | null>(null);

function initialUiFont(): UiFontId {
  if (typeof window === "undefined" || hasPublicDemoCookieInDocument()) {
    return DEFAULT_UI_FONT;
  }
  return readStoredUiFont();
}

export function UiFontProvider({ children }: { children: React.ReactNode }) {
  const [fontId, setFontIdState] = useState<UiFontId>(initialUiFont);

  useEffect(() => {
    const demo = hasPublicDemoCookieInDocument();
    const next = demo ? DEFAULT_UI_FONT : readStoredUiFont();
    setFontIdState(next);
    applyUiFont(next);
    if (!demo) writeStoredUiFont(next);
  }, []);

  const setFontId = useCallback((id: UiFontId) => {
    const resolved = normalizeUiFont(id);
    if (!hasPublicDemoCookieInDocument()) {
      writeStoredUiFont(resolved);
    }
    applyUiFont(resolved);
    setFontIdState(resolved);
  }, []);

  const syncFromSettings = useCallback((raw: string | undefined) => {
    if (raw == null || raw === "") return;
    const resolved = normalizeUiFont(raw);
    applyUiFont(resolved);
    if (!hasPublicDemoCookieInDocument()) {
      writeStoredUiFont(resolved);
    }
    setFontIdState(resolved);
  }, []);

  const value = useMemo(
    () => ({ fontId, setFontId, syncFromSettings }),
    [fontId, setFontId, syncFromSettings]
  );

  return <UiFontContext.Provider value={value}>{children}</UiFontContext.Provider>;
}

export function useUiFont(): UiFontContextValue {
  const ctx = useContext(UiFontContext);
  if (!ctx) {
    throw new Error("useUiFont must be used within UiFontProvider");
  }
  return ctx;
}
