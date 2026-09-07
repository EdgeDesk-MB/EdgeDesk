import { NextResponse } from "next/server";
import { loadActivityMixForDay } from "@/lib/admin/activity";
import { resolveActivityMixDay } from "@/lib/admin/activity-day";
import {
  buildActivityMixCharts,
  filterActivityMix,
} from "@/lib/admin/activity-mix";
import { excludedIdSet } from "@/lib/admin/exclude-accounts";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import { requireAdminApi } from "@/lib/admin/session";
import { listAppUsers } from "@/lib/services/app-users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const date = resolveActivityMixDay(new URL(request.url).searchParams.get("date"));
  const [mix, scope, users] = await Promise.all([
    loadActivityMixForDay(date),
    loadAdminAccountScope(),
    listAppUsers(),
  ]);
  const skipIds = excludedIdSet(scope.excludedIds);
  if (scope.excludeAdmins) {
    for (const user of users) {
      if (user.admin) skipIds.add(user.clerkUserId);
    }
  }

  return NextResponse.json({
    date,
    charts: buildActivityMixCharts(
      filterActivityMix(mix, skipIds.size > 0 ? skipIds : null)
    ),
  });
}
