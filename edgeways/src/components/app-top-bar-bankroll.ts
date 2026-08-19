/** In-bets takes the first row when money is tied up; otherwise Exchange, including £0.00. */
export function bankrollCompanion(inBets: number): "in-bets" | "exchange" {
  return inBets > 0.005 ? "in-bets" : "exchange";
}

export function bankrollAriaLabel(exchange: number, inBets: number, total: number): string {
  return bankrollCompanion(inBets) === "in-bets"
    ? `Bankroll: in-bets ${inBets.toFixed(2)}, total ${total.toFixed(2)}`
    : `Bankroll: exchange ${exchange.toFixed(2)}, total ${total.toFixed(2)}`;
}
