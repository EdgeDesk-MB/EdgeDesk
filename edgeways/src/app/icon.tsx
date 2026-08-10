import { cookies } from "next/headers";
import {
  BRAND_ACCENT_COOKIE_KEY,
  DEFAULT_BRAND_ACCENT_HEX,
  normalizeHex,
} from "@/lib/brand-accent";
import { buildAccentFaviconSvg } from "@/lib/brand/bolt-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

/** Tab favicon: bolt on the user's brand accent (cookie), Amber when unset. */
export default async function Icon() {
  const jar = await cookies();
  const hex =
    normalizeHex(jar.get(BRAND_ACCENT_COOKIE_KEY)?.value) ?? DEFAULT_BRAND_ACCENT_HEX;
  const svg = buildAccentFaviconSvg(hex);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
