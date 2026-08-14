import {
  renderShareCardImage,
  SHARE_CARD_CONTENT_TYPE,
} from "@/lib/marketing/share-card-image";

/**
 * Stable public share image on the custom domain.
 * Next's opengraph-image file convention hashes the path and emits a
 * *.vercel.app URL, which is SSO-gated, so Facebook cannot fetch it.
 */
export async function GET() {
  const image = await renderShareCardImage();
  image.headers.set("Content-Type", SHARE_CARD_CONTENT_TYPE);
  image.headers.set("Cache-Control", "public, max-age=3600");
  return image;
}
