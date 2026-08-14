import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureAppUser } from "@/lib/services/app-users";

export const dynamic = "force-dynamic";

function primaryEmail(
  user: {
    primaryEmailAddress?: { emailAddress: string } | null;
    emailAddresses?: Array<{ emailAddress: string }>;
  } | null
): string | null {
  return (
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null
  );
}

/** Idempotent: create or refresh the Neon/SQLite row for the signed-in Clerk user. */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    const user = await currentUser();
    const row = await ensureAppUser({
      clerkUserId: userId,
      email: primaryEmail(user),
    });
    return NextResponse.json({
      clerkUserId: row.clerkUserId,
      email: row.email,
    });
  } catch (e) {
    console.error("[account/sync] failed:", e);
    return NextResponse.json(
      { error: "Could not save the account row." },
      { status: 500 }
    );
  }
}
