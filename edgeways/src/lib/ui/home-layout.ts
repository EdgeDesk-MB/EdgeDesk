/**
 * Home widget personalisation (E2) - pure helpers for widget order and
 * visibility. The mobile deck honours full order + hidden; the desktop grid
 * honours hidden only (its two-column composition is deliberate). Defaults
 * reproduce the shipped Home exactly.
 */

export const HOME_WIDGET_IDS = ["hero", "do-next", "plan", "chart", "feed"] as const;
export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export const HOME_WIDGET_LABELS: Record<HomeWidgetId, string> = {
  hero: "Summary",
  "do-next": "Do next",
  plan: "Today's plan",
  chart: "Chart",
  feed: "History feed",
};

/**
 * Deck order includes `chart` so Settings can show/hide it, but the phone
 * does not render Chart as its own card — it sits on Summary. Reorder
 * skips `chart`; a visible Chart cannot hide Summary.
 */
export const DEFAULT_HOME_LAYOUT: HomeLayoutSettings = {
  deckOrder: ["hero", "plan", "chart", "feed", "do-next"],
  deckHidden: [],
  desktopHidden: [],
};

/** Chart is not a standalone mobile card; treat a stored "chart" pin as Summary. */
export function resolveMobileDeckCardId(id: string | null | undefined): string {
  return id === "chart" ? "hero" : (id ?? "hero");
}

export function isChartOnMobileSummary(layout: HomeLayoutSettings): boolean {
  return !layout.deckHidden.includes("chart");
}

export interface HomeLayoutSettings {
  /** Mobile deck card order (widget ids) */
  deckOrder: HomeWidgetId[];
  /** Widgets hidden from the mobile deck */
  deckHidden: HomeWidgetId[];
  /** Widgets hidden from the desktop grid */
  desktopHidden: HomeWidgetId[];
}

function isWidgetId(value: unknown): value is HomeWidgetId {
  return (HOME_WIDGET_IDS as readonly string[]).includes(String(value));
}

function cleanIds(raw: unknown): HomeWidgetId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<HomeWidgetId>();
  for (const v of raw) {
    if (isWidgetId(v)) seen.add(v);
  }
  return [...seen];
}

/**
 * The only path into storage: drops unknown ids, dedupes, appends missing
 * widgets to the order (new widgets appear rather than vanish), and
 * guarantees at least one visible widget per mode.
 */
export function normalizeHomeLayout(raw: unknown): HomeLayoutSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const deckOrder = cleanIds(r.deckOrder);
  for (const id of DEFAULT_HOME_LAYOUT.deckOrder) {
    if (!deckOrder.includes(id)) deckOrder.push(id);
  }

  let deckHidden = cleanIds(r.deckHidden);
  if (deckHidden.length >= HOME_WIDGET_IDS.length) {
    deckHidden = deckHidden.filter((id) => id !== deckOrder[0]);
  }

  let desktopHidden = cleanIds(r.desktopHidden);
  if (desktopHidden.length >= HOME_WIDGET_IDS.length) {
    desktopHidden = desktopHidden.filter((id) => id !== "hero");
  }

  // Chart lives on Summary on the phone; a visible chart cannot hide Summary.
  if (!deckHidden.includes("chart") && deckHidden.includes("hero")) {
    deckHidden = deckHidden.filter((id) => id !== "hero");
  }

  return { deckOrder, deckHidden, desktopHidden };
}

/** Order and filter deck cards; cards absent from the input stay absent. */
export function applyDeckLayout<T extends { id: string }>(
  cards: T[],
  layout: HomeLayoutSettings
): T[] {
  const hidden = new Set<string>(layout.deckHidden);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered: T[] = [];
  for (const id of layout.deckOrder) {
    const card = byId.get(id);
    if (card && !hidden.has(id)) ordered.push(card);
  }
  // Cards with ids outside the known set keep their original position at the end.
  for (const card of cards) {
    if (!layout.deckOrder.includes(card.id as HomeWidgetId) && !hidden.has(card.id)) {
      ordered.push(card);
    }
  }
  return ordered;
}

/** Move a widget one step within the deck order; returns a new order. */
export function moveWidget(
  order: HomeWidgetId[],
  id: HomeWidgetId,
  direction: -1 | 1
): HomeWidgetId[] {
  // Chart is not a swipe card — keep it where it sits and skip over it.
  if (id === "chart") return order;
  const index = order.indexOf(id);
  if (index < 0) return order;
  let target = index + direction;
  while (target >= 0 && target < order.length && order[target] === "chart") {
    target += direction;
  }
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  next[index] = next[target]!;
  next[target] = id;
  return next;
}

/**
 * Deck show/hide. Chart sits on Summary, so showing Chart unhides Summary
 * and hiding Summary also hides Chart.
 */
export function toggleDeckHidden(
  hidden: HomeWidgetId[],
  id: HomeWidgetId,
  visible: boolean
): HomeWidgetId[] {
  let next = visible ? hidden.filter((x) => x !== id) : [...new Set([...hidden, id])];
  if (id === "chart" && visible) {
    next = next.filter((x) => x !== "hero");
  }
  if (id === "hero" && !visible && !next.includes("chart")) {
    next = [...next, "chart"];
  }
  return next;
}
