import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { saveAppUserOnboardingProfile } from "@/lib/services/app-users";
import {
  ONBOARDING_EXPERIENCE,
  ONBOARDING_HEARD,
  ONBOARDING_WHY,
  type OnboardingProfile,
} from "@/lib/onboarding-profile";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

const experienceIds = ONBOARDING_EXPERIENCE.map((row) => row.id) as [
  (typeof ONBOARDING_EXPERIENCE)[number]["id"],
  ...(typeof ONBOARDING_EXPERIENCE)[number]["id"][],
];
const whyIds = ONBOARDING_WHY.map((row) => row.id) as [
  (typeof ONBOARDING_WHY)[number]["id"],
  ...(typeof ONBOARDING_WHY)[number]["id"][],
];
const heardIds = ONBOARDING_HEARD.map((row) => row.id) as [
  (typeof ONBOARDING_HEARD)[number]["id"],
  ...(typeof ONBOARDING_HEARD)[number]["id"][],
];

const bodySchema = z.object({
  experience: z.enum(experienceIds),
  whyHere: z.union([z.enum(whyIds), z.array(z.enum(whyIds)).min(1)]),
  whyHereOther: z.string().max(200).nullable().optional(),
  attribution: z.enum([...heardIds, "skipped"]),
  attributionOther: z.string().max(200).nullable().optional(),
});

export const POST = withDeskScope(async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the answers and try again." }, { status: 400 });
  }

  const whyHere = Array.isArray(parsed.data.whyHere)
    ? parsed.data.whyHere
    : [parsed.data.whyHere];

  const profile: OnboardingProfile = {
    experience: parsed.data.experience,
    whyHere,
    whyHereOther: parsed.data.whyHereOther?.trim() || null,
    attribution: parsed.data.attribution,
    attributionOther: parsed.data.attributionOther?.trim() || null,
    savedAt: Date.now(),
  };

  try {
    const row = await saveAppUserOnboardingProfile({
      clerkUserId: userId,
      profile,
    });
    return NextResponse.json({ ok: true, savedAt: row.onboardingProfile?.savedAt ?? profile.savedAt });
  } catch (error) {
    console.error("[account/onboarding]", error);
    return NextResponse.json({ error: "Could not save set-up answers." }, { status: 500 });
  }
});
