/**
 * Home widget personalisation (E2) - pure helpers for widget order and
 * visibility. The mobile deck honours full order + hidden; the desktop grid
 * honours hidden only (its two-column composition is deliberate). Defaults
 * reproduce the shipped Home exactly.
 */

export const HOME_WIDGET_IDS = ["hero", "do-next", "plan", "chart", "feed"] as const;
export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export const HOME_WIDGET_LABELS: Record<HomeWidgetId, string> = {
  hero: "Overview",
  "do-next": "Do next",
  plan: "Today's plan",
  chart: "Chart",
  feed: "Feed",
};

/** Deck order matches the shipped C1 deck; desktop shows everything. */
export const DEFAULT_HOME_LAYOUT: HomeLayoutSettings = {
  deckOrder: ["hero", "plan", "chart", "feed", "do-next"],
  deckHidden: [],
  desktopHidden: [],
};

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
  const index = order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  next[index] = next[target]!;
  next[target] = id;
  return next;
}
