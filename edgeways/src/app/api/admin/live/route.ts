import { NextResponse } from "next/server";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import { loadLiveSnapshot } from "@/lib/admin/live-events";
import { readAdminLiveSettings } from "@/lib/admin/live-settings";
import { requireAdminApi } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const sinceRaw = Number(url.searchParams.get("since"));
  const now = Date.now();
  const since =
    Number.isFinite(sinceRaw) && sinceRaw > 0 ? Math.min(Math.floor(sinceRaw), now) : now;

  const [scope, settings] = await Promise.all([
    loadAdminAccountScope(),
    readAdminLiveSettings(),
  ]);
  const snapshot = await loadLiveSnapshot({
    since,
    excludeAdmins: scope.excludeAdmins,
    excludedIds: scope.excludedIds,
    now,
  });

  return NextResponse.json({
    fingerprint: snapshot.fingerprint,
    now: snapshot.now,
    events: snapshot.events,
    activeCriticalKeys: snapshot.activeCriticalKeys,
    settings,
  });
}
