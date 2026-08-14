import OpenGraphImage, { contentType } from "../(marketing)/opengraph-image";

/**
 * Stable public share image. Next's file convention hashes
 * /opengraph-image and metadataBase was resolving to the SSO-gated
 * *.vercel.app host, so Facebook could not fetch the thumbnail.
 */
export async function GET() {
  const image = await OpenGraphImage();
  image.headers.set("Content-Type", contentType);
  image.headers.set("Cache-Control", "public, max-age=3600");
  return image;
}
