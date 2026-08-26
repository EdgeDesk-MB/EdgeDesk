import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { eq, like, isNull } from "drizzle-orm";
import { resolveAlertsInboxMode } from "@/lib/alerts/inbox-access";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { db, alertsInbox } from "@/lib/db";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { publicDemoAlertsInbox } from "@/lib/demo/public-desk-api";
import {
  listInbox,
  markAllRead,
  markRead,
  markReadByDedupe,
  markReadByDedupePrefix,
  recordAlerts,
} from "@/lib/services/alerts-inbox";
import { dismissPush, sendPush } from "@/lib/services/push";
import { withDeskScope } from "@/lib/db/with-desk-scope";

async function alertsInboxMode() {
  const demoActive = (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value === "1";
  return resolveAlertsInboxMode({
    publicDemo: demoActive,
    neonDesk: isNeonDesk(),
  });
}

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const mode = await alertsInboxMode();
  if (mode === "demo") {
    return NextResponse.json({ alerts: publicDemoAlertsInbox() });
  }
  if (mode === "hosted_empty") {
    return NextResponse.json({ alerts: [] });
  }
  return NextResponse.json({ alerts: listInbox() });
});

const recordSchema = z.object({
  alerts: z
    .array(
      z.object({
        key: z.string().min(1).max(300),
        kind: z.string().min(1).max(50),
        title: z.string().min(1).max(300),
        body: z.string().max(1000).nullable().optional(),
        href: z.string().max(300).nullable().optional(),
      })
    )
    .min(1)
    .max(100),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const parsed = recordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mode = await alertsInboxMode();
  if (mode !== "desk") {
    return NextResponse.json({ recorded: 0 });
  }
  const recorded = recordAlerts(parsed.data.alerts);
  // F3: fan out to subscribed devices - fire-and-forget, the inbox row is
  // already the durable record.
  if (recorded > 0) {
    for (const alert of parsed.data.alerts) {
      void sendPush(alert).catch(() => {});
    }
  }
  return NextResponse.json({ recorded });
});

const patchSchema = z.union([
  z.object({ id: z.number().int().positive(), read: z.literal(true) }),
  z.object({ dedupe: z.string().min(1).max(300), read: z.literal(true) }),
  z.object({ dedupePrefix: z.string().min(1).max(300), read: z.literal(true) }),
  z.object({ all: z.literal(true), read: z.literal(true) }),
]);

export const PATCH = withDeskScope(async function PATCH(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mode = await alertsInboxMode();
  if (mode !== "desk") {
    return NextResponse.json({ updated: 0 });
  }
  if ("all" in parsed.data) {
    const unreadTags = db
      .select({ dedupe: alertsInbox.dedupe })
      .from(alertsInbox)
      .where(isNull(alertsInbox.readAt))
      .all()
      .map((r) => r.dedupe);
    const updated = markAllRead();
    if (unreadTags.length > 0) void dismissPush(unreadTags).catch(() => {});
    return NextResponse.json({ updated });
  }
  if ("dedupePrefix" in parsed.data) {
    const prefix = parsed.data.dedupePrefix.replace(/%/g, "");
    const tags = db
      .select({ dedupe: alertsInbox.dedupe })
      .from(alertsInbox)
      .where(like(alertsInbox.dedupe, `${prefix}%`))
      .all()
      .map((r) => r.dedupe);
    const updated = markReadByDedupePrefix(parsed.data.dedupePrefix);
    if (tags.length > 0) void dismissPush(tags).catch(() => {});
    return NextResponse.json({ updated });
  }
  if ("dedupe" in parsed.data) {
    const updated = markReadByDedupe(parsed.data.dedupe);
    void dismissPush([parsed.data.dedupe]).catch(() => {});
    return NextResponse.json({ updated });
  }
  const row = db
    .select({ dedupe: alertsInbox.dedupe })
    .from(alertsInbox)
    .where(eq(alertsInbox.id, parsed.data.id))
    .get();
  markRead(parsed.data.id);
  if (row?.dedupe) void dismissPush([row.dedupe]).catch(() => {});
  return NextResponse.json({ updated: 1 });
});
