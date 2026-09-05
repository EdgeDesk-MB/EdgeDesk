import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  isPublicAssetPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
  requestHostname,
  shouldRedirectWwwToApex,
} from "@/lib/site-surface";
import {
  isPublicDemoDeskPath,
  PUBLIC_DEMO_COOKIE,
  PUBLIC_DEMO_LIVE_PARAM,
} from "@/lib/demo/public-demo";
import { verifyPublicDemoCookieValue } from "@/lib/demo/public-demo-cookie";
import { stampReferralCookie } from "@/lib/referrals/persist";

/**
 * Next.js 16+: file must be named proxy.ts (Clerk + Next convention).
 * Combines Clerk session handling with the SITE_SURFACE gate.
 * Production is `app`. Waitlist still blocks /desk when the env is not app.
 */
export default clerkMiddleware(async (_auth, request) => {
  const response = await handleSurface(request);
  stampReferralCookie(request.nextUrl.searchParams.get("ref"), response.cookies);
  return response;
});

async function handleSurface(request: NextRequest): Promise<NextResponse> {
  const liveUrl = request.nextUrl.clone();
  if (liveUrl.searchParams.get(PUBLIC_DEMO_LIVE_PARAM) === "1") {
    liveUrl.searchParams.delete(PUBLIC_DEMO_LIVE_PARAM);
    const response = NextResponse.redirect(liveUrl);
    response.cookies.set(PUBLIC_DEMO_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  // www is a Search hostname. Serve icons there; 308 everything else to apex.
  if (
    requestHostname(request) === "www.edgeways.app" &&
    shouldRedirectWwwToApex(request.nextUrl.pathname)
  ) {
    const dest = new URL(request.url);
    dest.protocol = "https:";
    dest.hostname = "edgeways.app";
    dest.port = "";
    return NextResponse.redirect(dest, 308);
  }

  if (
    (request.nextUrl.pathname === "/settings" ||
      request.nextUrl.pathname === "/settings/") &&
    request.nextUrl.searchParams.get("tab") === "integrations"
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/admin/feeds";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  if (!isWaitlistSurface()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicAssetPath(pathname) || isWaitlistAllowedPath(pathname)) {
    return NextResponse.next();
  }

  const demoCookie = request.cookies.get(PUBLIC_DEMO_COOKIE)?.value;
  if (
    (await verifyPublicDemoCookieValue(demoCookie)) &&
    (isPublicDemoDeskPath(pathname) ||
      pathname === "/api/state" ||
      pathname.startsWith("/api/accounts") ||
      pathname.startsWith("/api/settings") ||
      pathname.startsWith("/api/racing") ||
      pathname.startsWith("/api/offers"))
  ) {
    return NextResponse.next();
  }

  const home = request.nextUrl.clone();
  home.pathname = "/";
  home.search = "";
  return NextResponse.redirect(home);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
