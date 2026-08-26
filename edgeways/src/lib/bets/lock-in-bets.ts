/**
 * Lock-in trades logged from Profit Tracker (sibling lay/back, not merged).
 * Labels and notes are written by LockInDialog.
 */
export function isLockInLoggedBet(bet: {
  label: string;
  notes?: string | null;
}): boolean {
  if (/^lock-in (lay|back)\b/i.test(bet.label.trim())) return true;
  return (bet.notes ?? "").startsWith("Lock-in close of");
}
