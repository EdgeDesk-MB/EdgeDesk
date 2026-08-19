/**
 * Host the current browser is on. Used for Stripe return URLs.
 * Do not use NEXT_PUBLIC_SITE_URL here: that is the public marketing origin
 * and would send a local checkout to production.
 */
export function requestOrigin(request: Request): string {
  const hostHeader =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = hostHeader?.split(",")[0]?.trim();
  if (host) {
    const protoHeader = request.headers.get("x-forwarded-proto");
    const proto =
      protoHeader?.split(",")[0]?.trim() ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
