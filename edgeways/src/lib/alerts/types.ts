/**
 * Alert engine contracts (C4). Rules produce EdgeAlerts; channels deliver
 * them. Phase-4 web push (B5/B6 sentinels) and any future server backend
 * implement AlertChannel without touching rule logic.
 */

export type EdgeAlertKind =
  | "offer_expiring"
  | "race_off_soon"
  | "result_settled"
  | "naked_exposure"
  | "two_up_lock"
  | "user_reminder";

/**
 * In-app toast behaviour.
 * - sticky: OnEvent / automation (stays until dismissed, close control).
 * - ephemeral: feedback for an action the user just took (auto-closes, no X).
 */
export type EdgeAlertDelivery = "sticky" | "ephemeral";

export interface EdgeAlert {
  /** Stable dedupe key - a given alert fires once per key per session. */
  key: string;
  kind: EdgeAlertKind;
  title: string;
  /** Body without bookie brackets/prefix - toast renders VenueBadge separately. */
  body: string;
  /** Bookie/exchange for toast VenueBadge and plain-text channels. */
  bookmaker?: string | null;
  /** P&L polarity for in-app toast colour (MoneyFlow green / negative red). */
  tone?: "positive" | "negative" | null;
  /** Deep link into the relevant desk */
  href: string;
  /** Defaults to sticky when omitted (automation / background settles). */
  delivery?: EdgeAlertDelivery;
}

export interface AlertChannel {
  notify(alert: EdgeAlert): void;
  /**
   * Update an on-screen sticky toast (countdown copy) without OS notify / inbox.
   * No-op if the user already dismissed that toast.
   */
  refresh?(alert: EdgeAlert): void;
  /** Pull down sticky in-app toasts for these keys (condition cleared). */
  dismiss?(keys: string[]): void;
}

/** Per-kind toggles - mirrors the AppSettings alert fields. */
export interface AlertPrefs {
  offerExpiring: boolean;
  raceOffSoon: boolean;
  resultSettled: boolean;
  nakedExposure: boolean;
  twoUpLock: boolean;
}
