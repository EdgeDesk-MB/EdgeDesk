import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  isPublicAssetPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
} from "@/lib/site-surface";
import {
  hasPublicDemoCookie,
  isPublicDemoDeskPath,
  PUBLIC_DEMO_COOKIE,
  PUBLIC_DEMO_LIVE_PARAM,
} from "@/lib/demo/public-demo";

/**
 * Next.js 16+: file must be named proxy.ts (Clerk + Next convention).
 * Combines Clerk session handling with SITE_SURFACE=waitlist gate.
 */
export default clerkMiddleware(async (_auth, request) => {
  const liveUrl = request.nextUrl.clone();
  if (liveUrl.searchParams.get(PUBLIC_DEMO_LIVE_PARAM) === "1") {
    liveUrl.searchParams.delete(PUBLIC_DEMO_LIVE_PARAM);
    const response = NextResponse.redirect(liveUrl);
    response.cookies.set(PUBLIC_DEMO_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
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
    hasPublicDemoCookie(`${PUBLIC_DEMO_COOKIE}=${demoCookie ?? ""}`) &&
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
