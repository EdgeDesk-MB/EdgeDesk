/** Short user-facing note from exchange feed / match errors (full detail in title). */
export function formatExchangeMatchError(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();

  if (text.includes("TOO_MUCH_DATA")) {
    return "Using lay estimates for some races";
  }
  if (text.includes("No matching Betfair market")) {
    return "No matching Betfair market";
  }
  if (text.includes("Betfair not configured")) {
    return "Betfair not configured";
  }

  const code = text.match(/"errorCode"\s*:\s*"([^"]+)"/)?.[1];
  if (code) {
    return code.replace(/_/g, " ").toLowerCase();
  }

  const fault = text.match(/"faultstring"\s*:\s*"([^"]+)"/)?.[1];
  if (fault && fault.length <= 48) return fault;

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
