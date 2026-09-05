import { NextResponse } from "next/server";
import { z } from "zod";
import { denyPublicDemoWrite } from "@/lib/demo/public-demo-guard";
import { withDeskScope } from "@/lib/db/with-desk-scope";
import {
  disableOfferInbox,
  enableOfferInbox,
  getOfferInboxStatus,
  offerInboxAvailable,
  rotateOfferInbox,
  sendTestForward,
} from "@/lib/services/offer-inbox";

export const dynamic = "force-dynamic";

const LOCKED_STATUS = {
  available: false,
  enabled: false,
  address: null,
  createdAt: null,
  totalReceived: 0,
  lastReceivedAt: null,
};

/**
 * Offer inbox settings: the desk's own forwarding address. Storage
 * dual-paths inside the service (Neon clerk-scoped when hosted, SQLite
 * locally); this route never touches a desk store directly. Admin-only
 * while the feature rolls out (offerInboxAvailable).
 */
export const GET = withDeskScope(async function GET() {
  if (!(await offerInboxAvailable())) {
    return NextResponse.json(LOCKED_STATUS);
  }
  return NextResponse.json(await getOfferInboxStatus());
});

const actionSchema = z.object({
  action: z.enum(["enable", "rotate", "disable", "test"]),
});

export const POST = withDeskScope(async function POST(req: Request) {
  const demoBlock = await denyPublicDemoWrite();
  if (demoBlock) return demoBlock;
  if (!(await offerInboxAvailable())) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    switch (parsed.data.action) {
      case "enable":
        return NextResponse.json(await enableOfferInbox());
      case "rotate":
        return NextResponse.json(await rotateOfferInbox());
      case "disable":
        return NextResponse.json(await disableOfferInbox());
      case "test": {
        const result = await sendTestForward();
        return NextResponse.json(result);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the offer inbox.";
    const status = message.startsWith("Sign in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
