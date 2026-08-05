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

type UiFontContextValue = {
  fontId: UiFontId;
  setFontId: (id: UiFontId) => void;
  /** Sync from AppSettings (SQLite) when it arrives. */
  syncFromSettings: (fontId: string | undefined) => void;
};

const UiFontContext = createContext<UiFontContextValue | null>(null);

export function UiFontProvider({ children }: { children: React.ReactNode }) {
  const [fontId, setFontIdState] = useState<UiFontId>(DEFAULT_UI_FONT);

  useEffect(() => {
    const stored = readStoredUiFont();
    setFontIdState(stored);
    applyUiFont(stored);
  }, []);

  const setFontId = useCallback((id: UiFontId) => {
    const resolved = normalizeUiFont(id);
    writeStoredUiFont(resolved);
    applyUiFont(resolved);
    setFontIdState(resolved);
  }, []);

  const syncFromSettings = useCallback((raw: string | undefined) => {
    if (raw == null || raw === "") return;
    const resolved = normalizeUiFont(raw);
    setFontIdState((prev) => {
      if (prev === resolved) return prev;
      applyUiFont(resolved);
      writeStoredUiFont(resolved);
      return resolved;
    });
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
