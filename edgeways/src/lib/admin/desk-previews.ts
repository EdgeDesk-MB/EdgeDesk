/**
 * Persist desk previews in operator_settings (same chrome env as the banner).
 * Missing row keeps the built-in gate (owner / admin) until you save.
 */
import "server-only";

import { isOperatorAdmin, isOwnerAdmin } from "@/lib/admin/emails";
import { isNeonDesk } from "@/lib/db/desk-backend";
import {
  DESK_PREVIEW_IDS,
  evaluateDeskPreview,
  normalizeDeskPreviewRule,
  normalizeDeskPreviews,
  parseDeskPreviews,
  type DeskPreviewId,
  type DeskPreviewSettings,
} from "@/lib/admin/desk-previews-shared";
import {
  listAppUsers,
  findAppUserByClerkId,
  type AdminUserRow,
} from "@/lib/services/app-users";
import { effectivePlan } from "@/lib/entitlements/effective-plan";

export type DeskPreviewsState = {
  settings: DeskPreviewSettings;
  persisted: boolean;
};

export function seedDeskPreviewsFromUsers(
  users: Pick<AdminUserRow, "clerkUserId" | "owner" | "admin">[]
): DeskPreviewSettings {
  return {
    twoup_scout: {
      mode: "allowlist",
      clerkUserIds: users.filter((user) => user.owner).map((user) => user.clerkUserId),
    },
    offer_inbox: {
      mode: "allowlist",
      clerkUserIds: users.filter((user) => user.admin).map((user) => user.clerkUserId),
    },
  };
}

export function legacyDeskPreviewAllowed(
  id: DeskPreviewId,
  user: { email: string | null | undefined; role?: string | null | undefined }
): boolean {
  if (id === "twoup_scout") return isOwnerAdmin(user.email);
  return isOperatorAdmin({ email: user.email, role: user.role });
}

export async function readDeskPreviews(): Promise<DeskPreviewsState> {
  const { readDeskPreviewValue } = await import("@/lib/admin/operator-settings");
  const raw = await readDeskPreviewValue();
  if (raw == null || !raw.trim()) {
    const users = await listAppUsers();
    return { settings: seedDeskPreviewsFromUsers(users), persisted: false };
  }
  return { settings: parseDeskPreviews(raw), persisted: true };
}

export async function writeDeskPreviews(
  patch: Partial<DeskPreviewSettings>
): Promise<DeskPreviewSettings> {
  const current = await readDeskPreviews();
  const next = normalizeDeskPreviews({
    ...current.settings,
    ...Object.fromEntries(
      DESK_PREVIEW_IDS.filter((id) => patch[id] != null).map((id) => [
        id,
        normalizeDeskPreviewRule(patch[id]),
      ])
    ),
  });
  const { writeDeskPreviewValue } = await import("@/lib/admin/operator-settings");
  await writeDeskPreviewValue(JSON.stringify(next));
  return next;
}

export async function resolveDeskPreview(
  id: DeskPreviewId,
  clerkUserId: string | null | undefined
): Promise<boolean> {
  if (!isNeonDesk()) return true;
  const idTrimmed = clerkUserId?.trim();
  if (!idTrimmed) return false;
  try {
    const { settings, persisted } = await readDeskPreviews();
    if (!persisted) {
      const user = await findAppUserByClerkId(idTrimmed);
      return legacyDeskPreviewAllowed(id, {
        email: user?.email ?? null,
        role: user?.role ?? null,
      });
    }
    const rule = settings[id];
    return evaluateDeskPreview({
      hosted: true,
      mode: rule.mode,
      clerkUserIds: rule.clerkUserIds,
      clerkUserId: idTrimmed,
    });
  } catch (err) {
    console.error("[desk-previews] resolve failed:", err);
    return false;
  }
}

export function entitledTwoupScoutClerkIds(
  users: Pick<AdminUserRow, "clerkUserId" | "plan" | "billingStatus">[]
): string[] {
  return users
    .filter((user) => effectivePlan(user) === "edge")
    .map((user) => user.clerkUserId);
}
