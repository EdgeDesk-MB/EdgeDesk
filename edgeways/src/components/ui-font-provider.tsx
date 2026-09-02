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

export function UiFontProvider({ children }: { children: React.ReactNode }) {
  // Default on first paint so SSR HTML matches the client. FOUC scripts already
  // applied the stored font on <html>; sync React state after mount.
  const [fontId, setFontIdState] = useState<UiFontId>(DEFAULT_UI_FONT);

  useEffect(() => {
    const demo = hasPublicDemoCookieInDocument();
    const next = demo ? DEFAULT_UI_FONT : readStoredUiFont();
    applyUiFont(next);
    if (!demo) writeStoredUiFont(next);
    setFontIdState((prev) => (prev === next ? prev : next));
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
