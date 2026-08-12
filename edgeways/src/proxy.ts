import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  isPublicAssetPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
} from "@/lib/site-surface";

/**
 * Next.js 16+: file must be named proxy.ts (Clerk + Next convention).
 * Combines Clerk session handling with SITE_SURFACE=waitlist gate.
 */
export default clerkMiddleware(async (_auth, request) => {
  if (!isWaitlistSurface()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicAssetPath(pathname) || isWaitlistAllowedPath(pathname)) {
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
