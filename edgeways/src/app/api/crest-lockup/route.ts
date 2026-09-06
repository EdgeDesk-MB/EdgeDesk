import { NextRequest, NextResponse } from "next/server";
import {
  CREST_LOCKUP_CONTENT_TYPE,
  renderCrestLockupImage,
} from "@/lib/alerts/crest-lockup-image";
import { parseCrestLockupSearch } from "@/lib/alerts/crest-lockup";
import { NOTIFICATION_ICON } from "@/lib/alerts/notification-icons";
import { readFixtureStore } from "@/lib/services/fixture-store";

export const dynamic = "force-dynamic";

function boltRedirect(request: NextRequest) {
  return NextResponse.redirect(new URL(NOTIFICATION_ICON, request.url), 302);
}

/**
 * Public 192px crest lock-up for the Android shade large-icon slot.
 * Reads the fixture store only — never hits the provider.
 */
export async function GET(request: NextRequest) {
  const parsed = parseCrestLockupSearch(request.nextUrl.searchParams);
  if (!parsed) return boltRedirect(request);

  try {
    const stored = await readFixtureStore(parsed.date).catch(() => null);
    const fixture = stored?.fixtures.find((row) => row.externalId === parsed.externalId);
    const image = renderCrestLockupImage({
      homeLogo: fixture?.homeLogo,
      awayLogo: fixture?.awayLogo,
    });
    if (!image) return boltRedirect(request);

    image.headers.set("Content-Type", CREST_LOCKUP_CONTENT_TYPE);
    image.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    return image;
  } catch {
    return boltRedirect(request);
  }
}
