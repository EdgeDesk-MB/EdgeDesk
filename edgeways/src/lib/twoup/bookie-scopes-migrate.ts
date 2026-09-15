/**
 * Session brake for the write-on-read bookieScopes seed (EDGE-156).
 * A failed PATCH must not re-arm this, or /early-payout signed-out and the public
 * demo loop PATCH /api/settings until the tab dies.
 */

export function createBookieScopesMigrateLock() {
  let started = false;
  return {
    tryStart() {
      if (started) return false;
      started = true;
      return true;
    },
    /** Tests and a later user-switch reset only. Never call from a failed PATCH. */
    reset() {
      started = false;
    },
  };
}

export const bookieScopesMigrateLock = createBookieScopesMigrateLock();

/** Stable default so `opts?.walletNames ?? []` cannot allocate every render. */
export const EMPTY_BOOKIE_SCOPE_WALLET_NAMES: readonly string[] = [];
