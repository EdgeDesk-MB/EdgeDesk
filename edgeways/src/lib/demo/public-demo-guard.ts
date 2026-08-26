/**
 * EDGE-106: server-side demo-session guard. The client blocks demo writes
 * with a toast, but the cookie is public by design, so the routes enforce
 * too: a signed-in user in a demo session must not mutate (or read) their
 * live desk through it.
 */
import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PUBLIC_DEMO_COOKIE,
  publicDemoWriteMessage,
} from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";

export async function isPublicDemoRequest(): Promise<boolean> {
  return verifyPublicDemoCookieValue(
    (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value
  );
}

/** 403 when the signed demo cookie is active, else null. */
export async function denyPublicDemoWrite(): Promise<NextResponse | null> {
  if (!(await isPublicDemoRequest())) return null;
  return NextResponse.json({ error: publicDemoWriteMessage() }, { status: 403 });
}
