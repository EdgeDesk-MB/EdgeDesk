import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildSubscribeReceipt } from "@/lib/billing/receipt-view";
import { getStripe } from "@/lib/billing/stripe-server";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session." }, { status: 400 });
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (
      session.client_reference_id &&
      session.client_reference_id !== userId
    ) {
      return NextResponse.json({ error: "Not this account." }, { status: 403 });
    }
    const receipt = buildSubscribeReceipt(session);
    if (!receipt) {
      return NextResponse.json({ error: "No receipt yet." }, { status: 404 });
    }
    return NextResponse.json(receipt);
  } catch (error) {
    console.error("[billing/session]", error);
    return NextResponse.json({ error: "Could not load the slip." }, { status: 502 });
  }
});
