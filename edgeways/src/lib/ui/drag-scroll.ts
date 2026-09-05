/**
 * Pointer-flick physics for mouse drag-to-pan. Native wheel / touch already
 * coast; JS drag has to synthesise that, then settle onto snap points.
 */

export const EW_PANNING_ATTR = "data-ew-panning";

/** Ignore samples older than this when reading a flick. */
export const VELOCITY_WINDOW_MS = 80;
/** Below this, treat the release as a place-down (snap to nearest). */
export const FLING_THRESHOLD_PX_PER_MS = 0.35;
/** Extra travel after release: predictedScroll = current - velocity * this. */
export const COAST_MS = 280;
export const SETTLE_MS_MIN = 200;
export const SETTLE_MS_MAX = 480;
/** Compositor settle — ease-out, no overshoot. */
export const SETTLE_EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";
/** How much of an overscroll the row keeps (phone-like rubber). */
export const RUBBER_FACTOR = 0.32;

export type PointerSample = { t: number; x: number };

export function easeOutCubic(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - (1 - clamped) ** 3;
}

/** Pointer px/ms. Positive = pointer moved right (content should follow). */
export function pointerVelocityPxPerMs(samples: readonly PointerSample[]): number {
  if (samples.length < 2) return 0;
  const newest = samples[samples.length - 1]!;
  let oldest = samples[0]!;
  for (let i = samples.length - 2; i >= 0; i--) {
    const sample = samples[i]!;
    if (newest.t - sample.t > VELOCITY_WINDOW_MS) break;
    oldest = sample;
  }
  const dt = newest.t - oldest.t;
  if (dt < 8) return 0;
  return (newest.x - oldest.x) / dt;
}

export function clampScrollLeft(value: number, max: number): number {
  if (max <= 0) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

/** Allow a decaying pull past 0 / max so a flick at the edge does not hard-stop. */
export function rubberScrollLeft(
  desired: number,
  max: number,
  factor = RUBBER_FACTOR
): number {
  const hi = max < 0 ? 0 : max;
  if (desired < 0) return desired * factor;
  if (desired > hi) return hi + (desired - hi) * factor;
  return desired;
}

/** Frozen scrollLeft + this translateX is the visual pan (pointer-right → +tx). */
export function panTranslateX(startScroll: number, visualScroll: number): number {
  return startScroll - visualScroll;
}

/** Visual scrollLeft for a pointer delta, including edge rubber. */
export function visualScrollFromDx(
  startScroll: number,
  dx: number,
  max: number
): number {
  return rubberScrollLeft(startScroll - dx, max);
}

/** Snap target from layout offsets (transform-independent, unlike getBoundingClientRect). */
export function snapScrollFromContentOffset(
  contentOffset: number,
  scrollPadding: number,
  max: number
): number {
  return clampScrollLeft(contentOffset - scrollPadding, max);
}

function parseScrollPaddingInlineStart(el: HTMLElement): number {
  const raw = getComputedStyle(el).scrollPaddingInlineStart;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** scrollLeft values that align each snap child to the scroller's padding edge. */
export function readHorizontalSnapPositions(el: HTMLElement): number[] {
  const row = el.firstElementChild;
  if (!(row instanceof HTMLElement)) return [0];
  const pad = parseScrollPaddingInlineStart(el);
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const kids = Array.from(row.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
  if (kids.length === 0) return [0];
  return kids.map((child) =>
    snapScrollFromContentOffset(row.offsetLeft + child.offsetLeft, pad, max)
  );
}

/** Pointer-right (v > 0) decreases scrollLeft so the row follows the cursor. */
export function projectScrollLeft(
  current: number,
  velocityPxPerMs: number,
  max: number,
  coastMs = COAST_MS
): number {
  return clampScrollLeft(current - velocityPxPerMs * coastMs, max);
}

export function nearestValue(candidates: readonly number[], target: number): number {
  if (candidates.length === 0) return target;
  let best = candidates[0]!;
  let bestDist = Math.abs(best - target);
  for (let i = 1; i < candidates.length; i++) {
    const value = candidates[i]!;
    const dist = Math.abs(value - target);
    if (dist < bestDist) {
      best = value;
      bestDist = dist;
    }
  }
  return best;
}

export function nearestSnapIndex(snaps: readonly number[], current: number): number {
  if (snaps.length === 0) return 0;
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < snaps.length; i++) {
    const dist = Math.abs(snaps[i]! - current);
    if (dist < best) {
      best = dist;
      nearest = i;
    }
  }
  return nearest;
}

/** Next/previous snap scrollLeft, or null at the end of the strip. */
export function adjacentSnapValue(
  snaps: readonly number[],
  current: number,
  direction: -1 | 1
): number | null {
  if (snaps.length === 0) return null;
  return snaps[nearestSnapIndex(snaps, current) + direction] ?? null;
}

/**
 * Gentle release → nearest snap to where we are. A flick aims at the
 * projected coast position so you can skip a card the way a phone swipe does.
 */
export function pickSnapTarget(
  snaps: readonly number[],
  current: number,
  projected: number,
  velocityPxPerMs: number,
  flingThreshold = FLING_THRESHOLD_PX_PER_MS
): number {
  if (snaps.length === 0) return projected;
  if (Math.abs(velocityPxPerMs) >= flingThreshold) {
    return nearestValue(snaps, projected);
  }
  return nearestValue(snaps, current);
}

export function settleDurationMs(distance: number, velocityPxPerMs: number): number {
  const v = Math.max(0.25, Math.abs(velocityPxPerMs));
  const fromVelocity = Math.abs(distance) / v;
  return Math.min(SETTLE_MS_MAX, Math.max(SETTLE_MS_MIN, fromVelocity));
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Step one snap child. Leaves CSS scroll-snap on, so the browser finishes
 * the alignment (chevron / keyboard, not mouse-drag).
 */
export function scrollToAdjacentSnap(
  el: HTMLElement,
  direction: -1 | 1
): boolean {
  const target = adjacentSnapValue(
    readHorizontalSnapPositions(el),
    el.scrollLeft,
    direction
  );
  if (target == null) return false;
  if (prefersReducedMotion() || Math.abs(target - el.scrollLeft) < 0.5) {
    el.scrollLeft = target;
    return true;
  }
  el.scrollTo({ left: target, behavior: "smooth" });
  return true;
}
