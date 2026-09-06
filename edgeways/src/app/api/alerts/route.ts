import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { eq, like, isNull } from "drizzle-orm";
import { resolveAlertsInboxMode } from "@/lib/alerts/inbox-access";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { db, alertsInbox } from "@/lib/db";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";
import { publicDemoAlertsInbox } from "@/lib/demo/public-desk-api";
import {
  listInboxAsync,
  markAllReadAsync,
  markReadAsync,
  markReadByDedupeAsync,
  markReadByDedupePrefixAsync,
  recordAlertsAsync,
} from "@/lib/services/alerts-inbox";
import { dismissPush, sendPush } from "@/lib/services/push";
import { withDeskScope } from "@/lib/db/with-desk-scope";

async function alertsInboxMode() {
  const demoActive = await verifyPublicDemoCookieValue(
    (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value
  );
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
  return NextResponse.json({ alerts: await listInboxAsync() });
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
        icon: z
          .string()
          .max(400)
          .nullable()
          .optional()
          .refine(
            (value) =>
              value == null ||
              value.length === 0 ||
              value.startsWith("/api/crest-lockup?") ||
              value.startsWith("/icon-192.png")
          ),
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
  if (mode === "demo") {
    return NextResponse.json({ recorded: 0 });
  }
  const recorded = await recordAlertsAsync(parsed.data.alerts);
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

/** Dedupe keys a PATCH is about to mark read, for push dismiss tags. */
async function unreadTagsForPatch(
  data: z.infer<typeof patchSchema>
): Promise<string[]> {
  if (isNeonDesk()) {
    const neon = await import("@/lib/db/neon-alerts-inbox");
    if ("all" in data) return neon.listNeonUnreadDedupes();
    if ("dedupePrefix" in data) return neon.listNeonDedupesByPrefix(data.dedupePrefix);
    if ("dedupe" in data) return [data.dedupe];
    const dedupe = await neon.neonInboxDedupeById(data.id);
    return dedupe ? [dedupe] : [];
  }
  if ("all" in data) {
    return db
      .select({ dedupe: alertsInbox.dedupe })
      .from(alertsInbox)
      .where(isNull(alertsInbox.readAt))
      .all()
      .map((r) => r.dedupe);
  }
  if ("dedupePrefix" in data) {
    const prefix = data.dedupePrefix.replace(/%/g, "");
    return db
      .select({ dedupe: alertsInbox.dedupe })
      .from(alertsInbox)
      .where(like(alertsInbox.dedupe, `${prefix}%`))
      .all()
      .map((r) => r.dedupe);
  }
  if ("dedupe" in data) return [data.dedupe];
  const row = db
    .select({ dedupe: alertsInbox.dedupe })
    .from(alertsInbox)
    .where(eq(alertsInbox.id, data.id))
    .get();
  return row?.dedupe ? [row.dedupe] : [];
}

export const PATCH = withDeskScope(async function PATCH(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mode = await alertsInboxMode();
  if (mode === "demo") {
    return NextResponse.json({ updated: 0 });
  }
  const tags = await unreadTagsForPatch(parsed.data);
  let updated: number;
  if ("all" in parsed.data) {
    updated = await markAllReadAsync();
  } else if ("dedupePrefix" in parsed.data) {
    updated = await markReadByDedupePrefixAsync(parsed.data.dedupePrefix);
  } else if ("dedupe" in parsed.data) {
    updated = await markReadByDedupeAsync(parsed.data.dedupe);
  } else {
    await markReadAsync(parsed.data.id);
    updated = 1;
  }
  if (tags.length > 0) void dismissPush(tags).catch(() => {});
  return NextResponse.json({ updated });
});
