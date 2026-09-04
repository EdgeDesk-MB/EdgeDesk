import { describe, expect, it } from "vitest";
import {
  ensureAppUser,
  findAppUserByClerkId,
  saveAppUserReferralCode,
} from "@/lib/services/app-users";
import { claimReferral } from "@/lib/referrals/referral-service";

describe("claimReferral", () => {
  it("creates the referee row when /subscribe runs before account sync", async () => {
    const stamp = Date.now();
    const referrerId = `user_ref_${stamp}`;
    const refereeId = `user_joiner_${stamp}`;
    await ensureAppUser({ clerkUserId: referrerId, email: "ref@example.com" });
    await saveAppUserReferralCode({
      clerkUserId: referrerId,
      referralCode: "K7Q2-9XTM",
    });

    const result = await claimReferral({
      clerkUserId: refereeId,
      code: "k7q2-9xtm",
    });
    expect(result).toEqual({ status: "claimed", referrerCode: "K7Q2-9XTM" });

    const referee = await findAppUserByClerkId(refereeId);
    expect(referee?.referredBy).toBe(referrerId);
  });
});
