import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureServerEvent } from "@/lib/analytics/server-capture";
import { claimReferral } from "@/lib/referrals/referral-service";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/**
 * EDGE-67: claim a ?ref=CODE after sign-up. Sets referred_by once; the first
 * claim wins. The Stripe-side discount comes from entering the same code as
 * a promotion code at Checkout.
 */
export const POST = withDeskScope(async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  let code: string;
  try {
    const body = (await request.json()) as { code?: string };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const result = await claimReferral({ clerkUserId: userId, code });
    if (result.status === "claimed") {
      captureServerEvent(userId, "referral_redeemed", {
        referral_code: result.referrerCode,
        surface: "manual",
      });
      return NextResponse.json({ ok: true, status: result.status });
    }
    const status = result.status === "unknown_code" || result.status === "invalid" ? 404 : 409;
    return NextResponse.json({ ok: false, status: result.status }, { status });
  } catch (error) {
    console.error("[referrals/claim] failed:", error);
    return NextResponse.json(
      { error: "Could not save the referral." },
      { status: 500 }
    );
  }
});
