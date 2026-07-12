/** Client-safe exchange helpers - no SQLite / Node imports. */

import type { ExchangeProvider } from "./types";

export function exchangeNameToProvider(name: string): ExchangeProvider | null {
  const n = name.trim().toLowerCase();
  if (n.includes("betfair")) return "betfair";
  if (n.includes("betdaq")) return "betdaq";
  if (n.includes("matchbook")) return "matchbook";
  if (n.includes("smarkets")) return "smarkets";
  return null;
}
