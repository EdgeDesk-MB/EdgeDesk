import { NextResponse } from "next/server";
import { unsubscribeWaitlist } from "@/lib/services/waitlist";

export const dynamic = "force-dynamic";

async function redirectFor(req: Request, token: string) {
  const url = new URL(req.url);
  const result = await unsubscribeWaitlist(token);
  const dest = new URL("/waitlist/unsubscribed", url.origin);
  if (result.status === "invalid_token") {
    dest.searchParams.set("status", "invalid");
  } else if (result.status === "already_unsubscribed") {
    dest.searchParams.set("status", "already");
  } else {
    dest.searchParams.set("status", "ok");
  }
  return NextResponse.redirect(dest);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return redirectFor(req, url.searchParams.get("token") ?? "");
}

/** Mail-client one-click unsubscribe (RFC 8058). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    try {
      const form = await req.formData();
      const fromForm = form.get("token");
      if (typeof fromForm === "string") token = fromForm;
    } catch {
      // body optional for List-Unsubscribe=One-Click
    }
  }
  return redirectFor(req, token);
}
