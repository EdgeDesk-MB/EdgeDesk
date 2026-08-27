/** Short user-facing note from exchange feed / match errors (full detail in title). */
export function formatExchangeMatchError(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  if (text.includes("TOO_MUCH_DATA")) {
    return "Using lay estimates for some races";
  }
  if (
    text.includes("<!DOCTYPE") ||
    text.includes("Unexpected token '<'") ||
    text.includes("returned a web page instead of JSON")
  ) {
    return "Exchange feed unavailable";
  }
  if (
    text.includes("No matching Betfair market") ||
    text.includes("No matching exchange market")
  ) {
    return "No matching exchange market";
  }
  if (
    text.includes("Betfair not configured") ||
    text.includes("Exchange feed is not connected") ||
    text.includes("Betfair is not connected")
  ) {
    return "Exchange feed is not connected";
  }
  if (/partner credentials|partner API|not yet integrated|not yet supported/i.test(text)) {
    return "Live prices are not available for this exchange yet";
  }

  const code = text.match(/"errorCode"\s*:\s*"([^"]+)"/)?.[1];
  if (code) {
    if (code === "TOO_MUCH_DATA") return "Using lay estimates for some races";
    return "Exchange feed unavailable";
  }

  const fault = text.match(/"faultstring"\s*:\s*"([^"]+)"/)?.[1];
  if (fault && fault.length <= 48) return "Exchange feed unavailable";

  if (text.startsWith("Error: ") && text.length > 80) {
    return "Exchange feed unavailable";
  }
  if (text.length > 72) return "Exchange feed unavailable";

  return text.replace(/^Error:\s*/i, "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Betfair listMarketBook accepts a limited number of market IDs per call. */
export const BETFAIR_MARKET_BOOK_BATCH = 40;

export function chunkMarketIds(marketIds: string[]): string[][] {
  return chunk(marketIds, BETFAIR_MARKET_BOOK_BATCH);
}
