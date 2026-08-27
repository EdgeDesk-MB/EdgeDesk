import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SetupPageClient } from "@/components/help/setup-page-client";
import { claimReferralBestEffort } from "@/lib/referrals/referral-service";
import {
  REFERRAL_COOKIE,
  resolveReferralCode,
} from "@/lib/referrals/persist";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  // EDGE-67: free-path sign-ups land here with ?ref= instead of /subscribe.
  // Homepage share links persist the code in ew_ref when the query is gone.
  const { ref: queryRef } = await searchParams;
  const jar = await cookies();
  const ref = resolveReferralCode(queryRef, jar.get(REFERRAL_COOKIE)?.value);
  await claimReferralBestEffort(userId, ref);
  return <SetupPageClient />;
}
