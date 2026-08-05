"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyBrandAccent,
  BRAND_ACCENT_PRESETS,
  DEFAULT_BRAND_ACCENT_HEX,
  DEFAULT_BRAND_ACCENT_PRESET,
  hexForPreset,
  normalizeHex,
  readStoredBrandAccent,
  writeStoredBrandAccent,
  type BrandAccentPresetId,
  type BrandAccentState,
} from "@/lib/brand-accent";

type BrandAccentContextValue = BrandAccentState & {
  /** Colour currently applying (loader target). Null when settled. */
  pending: BrandAccentState | null;
  /** True when CSS vars have settled for the committed selection. */
  isReady: boolean;
  setPreset: (id: BrandAccentPresetId) => Promise<BrandAccentState>;
  setCustomHex: (hex: string) => Promise<BrandAccentState>;
  /** Sync from AppSettings (SQLite) when it arrives. */
  syncFromSettings: (presetId: string | undefined, hex: string | undefined) => void;
};

const BrandAccentContext = createContext<BrandAccentContextValue | null>(null);

function resolveState(next: BrandAccentState): BrandAccentState {
  return {
    presetId: next.presetId,
    hex: normalizeHex(next.hex) ?? DEFAULT_BRAND_ACCENT_HEX,
  };
}

export function BrandAccentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BrandAccentState>(() => ({
    presetId: DEFAULT_BRAND_ACCENT_PRESET,
    hex: DEFAULT_BRAND_ACCENT_HEX,
  }));
  const [pending, setPending] = useState<BrandAccentState | null>(null);
  const waiterRef = useRef<{
    resolve: (value: BrandAccentState) => void;
    state: BrandAccentState;
  } | null>(null);

  useEffect(() => {
    const stored = readStoredBrandAccent();
    setState(stored);
    applyBrandAccent(stored.hex);
    // Enable brand colour transitions only after the initial paint settles,
    // so load never animates Amber → selected.
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.documentElement.classList.add("brand-accent-ready");
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const commitAsync = useCallback((next: BrandAccentState) => {
    const resolved = resolveState(next);
    writeStoredBrandAccent(resolved);
    setPending(resolved);

    if (waiterRef.current) {
      // Superseded pick — unblock prior await; do not mark selected yet.
      waiterRef.current.resolve(waiterRef.current.state);
      waiterRef.current = null;
    }

    return new Promise<BrandAccentState>((resolve) => {
      waiterRef.current = { resolve, state: resolved };
      applyBrandAccent(resolved.hex, {
        onReady: () => {
          const waiter = waiterRef.current;
          if (!waiter || waiter.state !== resolved) {
            resolve(resolved);
            return;
          }
          waiterRef.current = null;
          setState(resolved);
          setPending(null);
          resolve(resolved);
        },
      });
    });
  }, []);

  const setPreset = useCallback(
    (id: BrandAccentPresetId) => {
      if (id === "custom") {
        return commitAsync({ presetId: "custom", hex: state.hex });
      }
      const preset = BRAND_ACCENT_PRESETS.find((p) => p.id === id);
      const next = {
        presetId: id,
        hex: preset?.hex ?? DEFAULT_BRAND_ACCENT_HEX,
      };
      if (state.presetId === next.presetId && state.hex === next.hex && !pending) {
        return Promise.resolve(state);
      }
      return commitAsync(next);
    },
    [commitAsync, pending, state]
  );

  const setCustomHex = useCallback(
    (hex: string) => {
      const normalized = normalizeHex(hex);
      if (!normalized) return Promise.resolve(state);
      if (state.presetId === "custom" && state.hex === normalized && !pending) {
        return Promise.resolve(state);
      }
      return commitAsync({ presetId: "custom", hex: normalized });
    },
    [commitAsync, pending, state]
  );

  const syncFromSettings = useCallback(
    (presetId: string | undefined, hex: string | undefined) => {
      if (!presetId && !hex) return;
      const id = (
        presetId === "amber" ||
        presetId === "viridian" ||
        presetId === "coral" ||
        presetId === "azure" ||
        presetId === "orchid" ||
        presetId === "citrine" ||
        presetId === "rose" ||
        presetId === "custom"
          ? presetId
          : DEFAULT_BRAND_ACCENT_PRESET
      ) as BrandAccentPresetId;
      const resolvedHex = hexForPreset(id, hex);
      setState((prev) => {
        if (prev.presetId === id && prev.hex === resolvedHex) return prev;
        applyBrandAccent(resolvedHex);
        writeStoredBrandAccent({ presetId: id, hex: resolvedHex });
        return { presetId: id, hex: resolvedHex };
      });
      setPending(null);
    },
    []
  );

  const value = useMemo(
    () => ({
      ...state,
      pending,
      isReady: pending === null,
      setPreset,
      setCustomHex,
      syncFromSettings,
    }),
    [state, pending, setPreset, setCustomHex, syncFromSettings]
  );

  return (
    <BrandAccentContext.Provider value={value}>{children}</BrandAccentContext.Provider>
  );
}

export function useBrandAccent(): BrandAccentContextValue {
  const ctx = useContext(BrandAccentContext);
  if (!ctx) {
    throw new Error("useBrandAccent must be used within BrandAccentProvider");
  }
  return ctx;
}
