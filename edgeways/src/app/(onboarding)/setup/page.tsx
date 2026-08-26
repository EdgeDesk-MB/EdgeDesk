import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SetupPageClient } from "@/components/help/setup-page-client";
import { claimReferralBestEffort } from "@/lib/referrals/referral-service";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  // EDGE-67: free-path sign-ups land here with ?ref= instead of /subscribe.
  const { ref } = await searchParams;
  await claimReferralBestEffort(userId, ref);
  return <SetupPageClient />;
}
