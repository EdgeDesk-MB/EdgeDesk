/** Public support addresses (EDGE-34 / EDGE-66). Zoho aliases on edgeways.app. */

export const HELLO_EMAIL = "hello@edgeways.app";
export const SUPPORT_EMAIL = "support@edgeways.app";

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
