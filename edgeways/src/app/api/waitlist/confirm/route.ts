import { NextResponse } from "next/server";
import { confirmWaitlist } from "@/lib/services/waitlist";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const result = await confirmWaitlist(token);

  const dest = new URL("/waitlist/confirmed", url.origin);
  if (result.status === "invalid_token") {
    dest.searchParams.set("status", "invalid");
  } else if (result.status === "already_confirmed") {
    dest.searchParams.set("status", "already");
  } else {
    dest.searchParams.set("status", "ok");
  }

  return NextResponse.redirect(dest);
}
