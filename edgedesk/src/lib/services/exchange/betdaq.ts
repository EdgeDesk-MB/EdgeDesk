/**
 * Betdaq Exchange API — stub placeholder.
 *
 * Betdaq's public API requires partner/vendor access (not available with a simple
 * app key like Betfair). When BETDAQ_API_KEY + BETDAQ_API_SECRET are set, this
 * module will attempt integration; until then it reports not_configured.
 */
import type {
  ExchangeConnectionStatus,
  ExchangeRaceContext,
  ExchangeRaceOdds,
} from "./types";

function credentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.BETDAQ_API_KEY?.trim();
  const apiSecret = process.env.BETDAQ_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function betdaqConfigured(): boolean {
  return !!credentials();
}

export function betdaqConnectionStatus(): ExchangeConnectionStatus {
  if (!credentials()) return "not_configured";
  // Partner API not yet implemented — credentials present but no public docs path
  return "unsupported";
}

export async function fetchBetdaqLayOdds(
  races: ExchangeRaceContext[]
): Promise<ExchangeRaceOdds[]> {
  const status = betdaqConnectionStatus();
  const message =
    status === "not_configured"
      ? "Betdaq API requires partner credentials — use Betfair for now"
      : "Betdaq partner API integration pending — use Betfair for live lay odds";

  return races.map((race) => ({
    externalId: race.externalId,
    quotes: [],
    source: "estimated" as const,
    error: message,
  }));
}
