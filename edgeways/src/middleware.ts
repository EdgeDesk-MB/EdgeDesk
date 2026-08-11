import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicAssetPath,
  isWaitlistAllowedPath,
  isWaitlistSurface,
} from "@/lib/site-surface";

/**
 * When SITE_SURFACE=waitlist (production marketing deploy), only the landing
 * page, waitlist follow-up pages, and waitlist API routes are reachable.
 * Everything else redirects to /.
 */
export function middleware(request: NextRequest) {
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
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static files in /public (images, sw.js, etc.).
     * Asset allowlist in isPublicAssetPath covers Next internals and metadata.
     */
    "/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|webp|js)$).*)",
  ],
};
