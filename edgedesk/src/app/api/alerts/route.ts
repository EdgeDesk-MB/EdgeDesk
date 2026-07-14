import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listInbox,
  markAllRead,
  markRead,
  recordAlerts,
} from "@/lib/services/alerts-inbox";

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
  return NextResponse.json({ recorded: recordAlerts(parsed.data.alerts) });
}

const patchSchema = z.union([
  z.object({ id: z.number().int().positive(), read: z.literal(true) }),
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
  markRead(parsed.data.id);
  return NextResponse.json({ updated: 1 });
}
