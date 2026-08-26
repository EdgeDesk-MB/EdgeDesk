import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  dismissPush,
  getVapidPublicKey,
  listSubscriptions,
  removeSubscription,
  saveSubscription,
  sendPush,
} from "@/lib/services/push";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  return NextResponse.json({
    publicKey: await getVapidPublicKey(),
    devices: (await listSubscriptions()).map((s) => ({
      id: s.id,
      label: s.label,
      createdAt: s.createdAt,
      lastOkAt: s.lastOkAt,
      // Last path segment only - enough for the client to spot a desync
      // without shipping the full FCM endpoint.
      endpointTail: s.endpoint.slice(-16),
    })),
  });
});

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  label: z.string().max(120).optional(),
});

const dismissSchema = z.object({
  dismiss: z.array(z.string().min(1).max(300)).min(1).max(50),
});

export const POST = withDeskScope(async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;

  // Test-send: prove the pipe end-to-end from Settings.
  // Stable tag so repeat taps replace one shade entry instead of stacking.
  if (body.test === true) {
    const result = await sendPush({
      key: "edgeways-test-push",
      title: "Edgeways push works",
      body: "This device will get sentinel alerts even with the app closed.",
      href: "/alerts",
    });
    return NextResponse.json(result);
  }

  // Close shade notifications by tag on every subscribed device.
  if (Array.isArray(body.dismiss)) {
    const parsed = dismissSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await dismissPush(parsed.data.dismiss);
    return NextResponse.json(result);
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const saved = await saveSubscription({
    endpoint: parsed.data.subscription.endpoint,
    p256dh: parsed.data.subscription.keys.p256dh,
    auth: parsed.data.subscription.keys.auth,
    label: parsed.data.label ?? null,
  });
  if (!saved) {
    // Hosted desk with no signed-in user: a subscription needs an owner.
    return NextResponse.json({ error: "Sign in to enable push." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export const DELETE = withDeskScope(async function DELETE(req: NextRequest) {
  const parsed = unsubscribeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await removeSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
});
