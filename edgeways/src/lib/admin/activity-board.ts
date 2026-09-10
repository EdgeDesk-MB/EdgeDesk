export const ACTIVITY_WIDGETS = [
  "pins",
  "timeline",
  "volume",
  "categories",
  "desks",
] as const;

export type ActivityWidgetId = (typeof ACTIVITY_WIDGETS)[number];

export type ActivityWidgetSpan = "half" | "full";

export const ACTIVITY_WIDGET_SPAN: Record<ActivityWidgetId, ActivityWidgetSpan> =
  {
    pins: "half",
    timeline: "half",
    volume: "full",
    categories: "full",
    desks: "full",
  };

export const ACTIVITY_WIDGET_LABEL: Record<ActivityWidgetId, string> = {
  pins: "Pins",
  timeline: "Desk activity",
  volume: "Volume mix",
  categories: "Categories",
  desks: "Per desk",
};

export const ACTIVITY_PRESETS = {
  pins: ["pins", "timeline", "volume", "categories", "desks"],
  volume: ["timeline", "volume", "pins", "categories", "desks"],
  mix: ["categories", "timeline", "pins", "volume", "desks"],
} as const satisfies Record<string, readonly ActivityWidgetId[]>;

export type ActivityBoardFocus = keyof typeof ACTIVITY_PRESETS;

export type ActivityBoardPreset = ActivityBoardFocus | "custom";

export type ActivityBoardLayout = {
  preset: ActivityBoardPreset;
  order: ActivityWidgetId[];
};

export const DEFAULT_ACTIVITY_BOARD: ActivityBoardLayout = {
  preset: "pins",
  order: [...ACTIVITY_PRESETS.pins],
};

export const ADMIN_ACTIVITY_BOARD_COOKIE = "ew_admin_activity_board";

export function isActivityWidgetId(value: string): value is ActivityWidgetId {
  return (ACTIVITY_WIDGETS as readonly string[]).includes(value);
}

export function isActivityBoardFocus(value: string): value is ActivityBoardFocus {
  return value === "pins" || value === "volume" || value === "mix";
}

export function normalizeActivityBoardOrder(
  raw: Iterable<string> | null | undefined
): ActivityWidgetId[] {
  const seen = new Set<ActivityWidgetId>();
  const out: ActivityWidgetId[] = [];
  if (raw) {
    for (const item of raw) {
      if (!isActivityWidgetId(item) || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  for (const id of ACTIVITY_WIDGETS) {
    if (seen.has(id)) continue;
    out.push(id);
  }
  return out;
}

export function activityBoardFromPreset(
  preset: ActivityBoardFocus
): ActivityBoardLayout {
  return { preset, order: [...ACTIVITY_PRESETS[preset]] };
}

export function moveActivityWidget(
  order: readonly ActivityWidgetId[],
  id: ActivityWidgetId,
  direction: -1 | 1
): ActivityBoardLayout {
  const next = normalizeActivityBoardOrder(order);
  const from = next.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= next.length) {
    return { preset: "custom", order: next };
  }
  const [item] = next.splice(from, 1);
  if (!item) return { preset: "custom", order: next };
  next.splice(to, 0, item);
  return { preset: "custom", order: next };
}

export function parseActivityBoard(
  raw: string | null | undefined
): ActivityBoardLayout {
  if (!raw?.trim()) return DEFAULT_ACTIVITY_BOARD;
  try {
    const parsed = JSON.parse(raw) as {
      preset?: unknown;
      order?: unknown;
    };
    const order = normalizeActivityBoardOrder(
      Array.isArray(parsed.order)
        ? parsed.order.filter((item): item is string => typeof item === "string")
        : null
    );
    if (parsed.preset === "custom") {
      return { preset: "custom", order };
    }
    if (isActivityBoardFocus(String(parsed.preset ?? ""))) {
      const preset = parsed.preset as ActivityBoardFocus;
      return { preset, order: [...ACTIVITY_PRESETS[preset]] };
    }
    return { preset: "custom", order };
  } catch {
    return DEFAULT_ACTIVITY_BOARD;
  }
}

export function serializeActivityBoard(layout: ActivityBoardLayout): string {
  const normalized = parseActivityBoard(JSON.stringify(layout));
  return JSON.stringify({
    preset: normalized.preset,
    order: normalized.order,
  });
}

export function writeActivityBoardCookie(layout: ActivityBoardLayout): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_ACTIVITY_BOARD_COOKIE}=${encodeURIComponent(
    serializeActivityBoard(layout)
  )};path=/admin;max-age=31536000;SameSite=Lax`;
}
