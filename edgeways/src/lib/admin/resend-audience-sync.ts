/**
 * Keep Resend Contacts in sync with app_users for Broadcasts.
 * Segments: All users, Free, Paid. Failures are logged only.
 */
import "server-only";
import { isBootstrapAdminEmail } from "@/lib/admin/emails";

export type ResendAudienceUser = {
  email?: string | null;
  plan: string;
  billingStatus: string;
};

export type ResendAudienceMembership = {
  allUsers: boolean;
  free: boolean;
  paid: boolean;
};

export type ResendAudienceSegmentIds = {
  allUsers: string;
  free: string;
  paid: string;
};

export function resendAudienceSegmentIds(
  env: Record<string, string | undefined> = process.env
): ResendAudienceSegmentIds {
  return {
    allUsers: env.RESEND_SEGMENT_ALL_USERS?.trim() || "",
    free: env.RESEND_SEGMENT_FREE?.trim() || "",
    paid: env.RESEND_SEGMENT_PAID?.trim() || "",
  };
}

export function shouldSyncResendAudience(user: ResendAudienceUser): boolean {
  const email = user.email?.trim();
  if (!email) return false;
  return !isBootstrapAdminEmail(email);
}

/** Trial sits in All users only. Paid is active / past_due. */
export function resendAudienceMembership(
  user: Pick<ResendAudienceUser, "plan" | "billingStatus">
): ResendAudienceMembership {
  const paid =
    user.billingStatus === "active" || user.billingStatus === "past_due";
  const free = !paid && user.plan === "free";
  return { allUsers: true, free, paid };
}

function audienceConfigured(
  ids: ResendAudienceSegmentIds,
  apiKey?: string
): boolean {
  return Boolean(apiKey && ids.allUsers && ids.free && ids.paid);
}

async function resendJson(
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 409 && res.status !== 404) {
    const body = await res.text().catch(() => "");
    console.error(
      `[resend-audience] ${init.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`
    );
  }
  return { ok: res.ok, status: res.status };
}

async function addToSegment(email: string, segmentId: string): Promise<void> {
  if (!segmentId) return;
  await resendJson(
    `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
    { method: "POST" }
  );
}

async function removeFromSegment(
  email: string,
  segmentId: string
): Promise<void> {
  if (!segmentId) return;
  await resendJson(
    `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
    { method: "DELETE" }
  );
}

export async function syncAppUserToResendAudience(
  user: ResendAudienceUser
): Promise<{ synced: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const ids = resendAudienceSegmentIds();
  const email = user.email?.trim().toLowerCase();

  if (!shouldSyncResendAudience({ ...user, email })) {
    return { synced: false, skippedReason: "skipped" };
  }
  if (!audienceConfigured(ids, apiKey) || !email) {
    console.info(
      "[resend-audience] RESEND_API_KEY or segment ids unset. Sync skipped."
    );
    return { synced: false, skippedReason: "unconfigured" };
  }

  const membership = resendAudienceMembership(user);
  const createSegments = [
    { id: ids.allUsers },
    ...(membership.free ? [{ id: ids.free }] : []),
    ...(membership.paid ? [{ id: ids.paid }] : []),
  ];

  try {
    const created = await resendJson("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: createSegments,
      }),
    });
    if (!created.ok && created.status !== 409) {
      return { synced: false, skippedReason: "resend_error" };
    }

    await addToSegment(email, ids.allUsers);
    if (membership.free) await addToSegment(email, ids.free);
    else await removeFromSegment(email, ids.free);
    if (membership.paid) await addToSegment(email, ids.paid);
    else await removeFromSegment(email, ids.paid);

    return { synced: true };
  } catch (err) {
    console.error("[resend-audience] sync failed:", err);
    return { synced: false, skippedReason: "resend_error" };
  }
}
