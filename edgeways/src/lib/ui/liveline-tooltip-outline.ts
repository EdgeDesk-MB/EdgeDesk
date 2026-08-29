"use client";

import { useLayoutEffect, type RefObject } from "react";

type Rgba = { r: number; g: number; b: number; a: number };

export function parseCssRgba(color: string): Rgba | null {
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = [...h].map((c) => c + c).join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const modern = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/
  );
  if (modern) {
    return {
      r: Number(modern[1]),
      g: Number(modern[2]),
      b: Number(modern[3]),
      a:
        modern[4] == null
          ? 1
          : modern[4].endsWith("%")
            ? Number(modern[4].slice(0, -1)) / 100
            : Number(modern[4]),
    };
  }

  const legacy = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (legacy) {
    return {
      r: Number(legacy[1]),
      g: Number(legacy[2]),
      b: Number(legacy[3]),
      a: legacy[4] == null ? 1 : Number(legacy[4]),
    };
  }

  return null;
}

export function isOpaqueCssColor(color: string): boolean {
  const parsed = parseCssRgba(color);
  return parsed != null && parsed.a >= 0.99;
}

/** Liveline light-theme tooltip / floating-label outlines (white or 95% white). */
export function isLivelineLightOutline(color: string): boolean {
  const parsed = parseCssRgba(color);
  if (!parsed) return false;
  return parsed.r >= 250 && parsed.g >= 250 && parsed.b >= 250 && parsed.a >= 0.9;
}

export function resolveChartBackdrop(from: HTMLElement): string {
  let node: HTMLElement | null = from;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (isOpaqueCssColor(bg)) return bg;
    node = node.parentElement;
  }
  return resolveCssColor("var(--page)");
}

/** Resolve a CSS colour (token or hex) to a computed rgb/rgba string. */
export function resolveCssColor(value: string): string {
  const probe = document.createElement("span");
  probe.style.backgroundColor = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return resolved;
}

type StrokeText = CanvasRenderingContext2D["strokeText"];

const originals = new WeakMap<CanvasRenderingContext2D, StrokeText>();

function patchCanvas(canvas: HTMLCanvasElement, host: HTMLElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || originals.has(ctx)) return;
  const original = CanvasRenderingContext2D.prototype.strokeText.bind(ctx);
  originals.set(ctx, original);
  ctx.strokeText = function strokeText(text, x, y, maxWidth) {
    const prev = ctx.strokeStyle;
    if (typeof prev === "string" && isLivelineLightOutline(prev)) {
      ctx.strokeStyle = resolveChartBackdrop(host);
      original(text, x, y, maxWidth);
      ctx.strokeStyle = prev;
      return;
    }
    original(text, x, y, maxWidth);
  };
}

function unpatchCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const original = originals.get(ctx);
  if (!original) return;
  ctx.strokeText = original;
  originals.delete(ctx);
}

/**
 * Liveline hardcodes light-mode hover-label outlines to white. Our charts sit
 * on `--page` / card grey, so retint those `strokeText` halos to the backdrop.
 */
export function useLivelineHoverOutline(
  hostRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) return;

    const apply = () => {
      host.querySelectorAll("canvas").forEach((canvas) => patchCanvas(canvas, host));
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      host.querySelectorAll("canvas").forEach(unpatchCanvas);
    };
  }, [enabled, hostRef]);
}
