import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { referralShareUrl } from "@/lib/referrals/code";
import { ensureReferralCodeForUser } from "@/lib/referrals/referral-service";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

/** EDGE-67: the signed-in user's referral code + share link (lazy-created). */
export const GET = withDeskScope(async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const { code, promotionCodeLive } = await ensureReferralCodeForUser(userId);
    return NextResponse.json({
      code,
      shareUrl: referralShareUrl(code),
      promotionCodeLive,
    });
  } catch (error) {
    console.error("[referrals/mine] failed:", error);
    return NextResponse.json(
      { error: "Could not load your referral code." },
      { status: 500 }
    );
  }
});
