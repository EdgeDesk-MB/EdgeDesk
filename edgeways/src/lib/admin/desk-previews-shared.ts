/**
 * Desk previews: unfinished surfaces gated by Off / Allowlist / Entitled.
 * Plan checks stay in entitlements. This only answers who may see it early.
 */

export const DESK_PREVIEW_IDS = ["twoup_scout", "offer_inbox"] as const;
export type DeskPreviewId = (typeof DESK_PREVIEW_IDS)[number];

export const DESK_PREVIEW_MODES = ["off", "allowlist", "entitled"] as const;
export type DeskPreviewMode = (typeof DESK_PREVIEW_MODES)[number];

export type DeskPreviewRule = {
  mode: DeskPreviewMode;
  clerkUserIds: string[];
};

export type DeskPreviewSettings = Record<DeskPreviewId, DeskPreviewRule>;

export const DESK_PREVIEW_META: Record<
  DeskPreviewId,
  {
    title: string;
    description: string;
    entitledLabel: string;
  }
> = {
  twoup_scout: {
    title: "2UP Edge picks",
    description:
      "Ranked Fair or Strong takes on pinned football. Still needs Edge.",
    entitledLabel: "Everyone on Edge",
  },
  offer_inbox: {
    title: "Offer inbox",
    description: "A forwarding address that drafts bookie emails as Planned offers.",
    entitledLabel: "Every signed-in desk",
  },
};

export const DESK_PREVIEW_MODE_LABEL: Record<DeskPreviewMode, string> = {
  off: "Off",
  allowlist: "Allowlist",
  entitled: "Entitled",
};

export const DESK_PREVIEW_MODE_HINT: Record<DeskPreviewMode, string> = {
  off: "Nobody on hosted. Localhost stays on.",
  allowlist: "Named accounts only, and they still need the plan.",
  entitled: "Everyone the plan already includes.",
};

export const DEFAULT_DESK_PREVIEW_RULE: DeskPreviewRule = {
  mode: "off",
  clerkUserIds: [],
};

export const DEFAULT_DESK_PREVIEWS: DeskPreviewSettings = {
  twoup_scout: { ...DEFAULT_DESK_PREVIEW_RULE, clerkUserIds: [] },
  offer_inbox: { ...DEFAULT_DESK_PREVIEW_RULE, clerkUserIds: [] },
};

export function isDeskPreviewId(value: unknown): value is DeskPreviewId {
  return (
    typeof value === "string" &&
    (DESK_PREVIEW_IDS as readonly string[]).includes(value)
  );
}

export function isDeskPreviewMode(value: unknown): value is DeskPreviewMode {
  return (
    typeof value === "string" &&
    (DESK_PREVIEW_MODES as readonly string[]).includes(value)
  );
}

export function normalizeClerkUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 200) break;
  }
  return out;
}

export function normalizeDeskPreviewRule(raw?: unknown): DeskPreviewRule {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<DeskPreviewRule>)
      : null;
  return {
    mode: isDeskPreviewMode(value?.mode) ? value.mode : "off",
    clerkUserIds: normalizeClerkUserIds(value?.clerkUserIds),
  };
}

/** Junk or empty input fails closed (every flag off). */
export function normalizeDeskPreviews(raw?: unknown): DeskPreviewSettings {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<Record<DeskPreviewId, unknown>>)
      : null;
  const next = { ...DEFAULT_DESK_PREVIEWS };
  if (!value) return next;
  for (const id of DESK_PREVIEW_IDS) {
    next[id] = normalizeDeskPreviewRule(value[id]);
  }
  return next;
}

export function parseDeskPreviews(raw: string | null | undefined): DeskPreviewSettings {
  if (!raw?.trim()) return { ...DEFAULT_DESK_PREVIEWS };
  try {
    return normalizeDeskPreviews(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_DESK_PREVIEWS };
  }
}

export function deskPreviewsEqual(
  a: DeskPreviewSettings,
  b: DeskPreviewSettings
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Hosted gate only. Localhost is always open.
 * `entitled` here means "preview is generally on"; the plan check is separate.
 */
export function evaluateDeskPreview(input: {
  hosted: boolean;
  mode: DeskPreviewMode;
  clerkUserIds: readonly string[];
  clerkUserId: string | null | undefined;
}): boolean {
  if (!input.hosted) return true;
  const clerkUserId = input.clerkUserId?.trim();
  if (!clerkUserId) return false;
  if (input.mode === "off") return false;
  if (input.mode === "entitled") return true;
  return input.clerkUserIds.includes(clerkUserId);
}

export function clerkIdsForPreviewWarm(input: {
  mode: DeskPreviewMode;
  allowlist: readonly string[];
  entitledClerkUserIds: readonly string[];
}): readonly string[] {
  if (input.mode === "off") return [];
  if (input.mode === "allowlist") return input.allowlist;
  return input.entitledClerkUserIds;
}
