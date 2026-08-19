import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findAppUserByClerkId } from "@/lib/services/app-users";
import { subscriptionAccountFromUser } from "@/lib/billing/subscription-view";
import { withDeskScope } from "@/lib/db/with-desk-scope";

export const dynamic = "force-dynamic";

export const GET = withDeskScope(async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const user = await findAppUserByClerkId(userId);
  return NextResponse.json(subscriptionAccountFromUser(user));
});
