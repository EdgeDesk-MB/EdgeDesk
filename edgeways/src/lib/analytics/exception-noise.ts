/**
 * Client exceptions we do not want in error tracking: browser-engine noise
 * and extension frames. Real app bugs must not be listed here.
 */

const NOISE_PATTERNS = [
  /ResizeObserver loop/i,
  /__firefox__/i,
];

export function isNoisyClientException(message: string | null | undefined): boolean {
  if (!message) return false;
  return NOISE_PATTERNS.some((pattern) => pattern.test(message));
}

function messagesFromProperties(properties: Record<string, unknown> | undefined): string[] {
  if (!properties) return [];
  const out: string[] = [];
  const values = properties.$exception_values;
  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value === "string") out.push(value);
    }
  }
  const list = properties.$exception_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      if (item && typeof item === "object" && "value" in item) {
        const value = (item as { value: unknown }).value;
        if (typeof value === "string") out.push(value);
      }
    }
  }
  if (typeof properties.$exception_message === "string") {
    out.push(properties.$exception_message);
  }
  return out;
}

/** Drop ResizeObserver loops and Firefox-extension frames from PostHog. */
export function shouldDropPosthogException(event: {
  event?: string;
  properties?: Record<string, unknown>;
} | null): boolean {
  if (!event || event.event !== "$exception") return false;
  return messagesFromProperties(event.properties).some(isNoisyClientException);
}
