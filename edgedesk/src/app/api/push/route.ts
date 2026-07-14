import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getVapidPublicKey,
  listSubscriptions,
  removeSubscription,
  saveSubscription,
  sendPush,
} from "@/lib/services/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    publicKey: getVapidPublicKey(),
    devices: listSubscriptions().map((s) => ({
      id: s.id,
      label: s.label,
      createdAt: s.createdAt,
      lastOkAt: s.lastOkAt,
    })),
  });
}

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  label: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;

  // Test-send: prove the pipe end-to-end from Settings.
  if (body.test === true) {
    const result = await sendPush({
      key: `test:${Date.now()}`,
      title: "EdgeDesk push works",
      body: "This device will get sentinel alerts even with the app closed.",
      href: "/alerts",
    });
    return NextResponse.json(result);
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  saveSubscription({
    endpoint: parsed.data.subscription.endpoint,
    p256dh: parsed.data.subscription.keys.p256dh,
    auth: parsed.data.subscription.keys.auth,
    label: parsed.data.label ?? null,
  });
  return NextResponse.json({ ok: true });
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function DELETE(req: NextRequest) {
  const parsed = unsubscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  removeSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
