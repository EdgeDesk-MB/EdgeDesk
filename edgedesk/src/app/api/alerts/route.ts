import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listInbox,
  markAllRead,
  markRead,
  markReadByDedupe,
  markReadByDedupePrefix,
  recordAlerts,
} from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ alerts: listInbox() });
}

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

export async function POST(req: NextRequest) {
  const parsed = recordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const recorded = recordAlerts(parsed.data.alerts);
  // F3: fan out to subscribed devices - fire-and-forget, the inbox row is
  // already the durable record.
  for (const alert of parsed.data.alerts) {
    void sendPush(alert).catch(() => {});
  }
  return NextResponse.json({ recorded });
}

const patchSchema = z.union([
  z.object({ id: z.number().int().positive(), read: z.literal(true) }),
  z.object({ dedupe: z.string().min(1).max(300), read: z.literal(true) }),
  z.object({ dedupePrefix: z.string().min(1).max(300), read: z.literal(true) }),
  z.object({ all: z.literal(true), read: z.literal(true) }),
]);

export async function PATCH(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if ("all" in parsed.data) {
    return NextResponse.json({ updated: markAllRead() });
  }
  if ("dedupePrefix" in parsed.data) {
    return NextResponse.json({
      updated: markReadByDedupePrefix(parsed.data.dedupePrefix),
    });
  }
  if ("dedupe" in parsed.data) {
    return NextResponse.json({ updated: markReadByDedupe(parsed.data.dedupe) });
  }
  markRead(parsed.data.id);
  return NextResponse.json({ updated: 1 });
}
