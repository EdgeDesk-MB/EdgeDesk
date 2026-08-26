import { NextResponse } from "next/server";
import {
  parsePublicDemoView,
  PUBLIC_DEMO_COOKIE,
} from "@/lib/demo/public-demo";
import { signPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = parsePublicDemoView(url.searchParams.get("view"));
  const dest = new URL("/desk", url.origin);
  dest.searchParams.set("demo", "1");
  dest.searchParams.set("view", view);
  if (url.searchParams.get("setup") === "1") {
    dest.searchParams.set("setup", "1");
  }

  const signed = await signPublicDemoCookieValue();
  if (!signed) {
    return new NextResponse("Demo unavailable", { status: 503 });
  }
  const response = NextResponse.redirect(dest);
  response.cookies.set(PUBLIC_DEMO_COOKIE, signed, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 4,
  });
  return response;
}
