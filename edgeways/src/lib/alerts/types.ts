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

export interface EdgeAlert {
  /** Stable dedupe key - a given alert fires once per key per session. */
  key: string;
  kind: EdgeAlertKind;
  title: string;
  body: string;
  /** Deep link into the relevant desk */
  href: string;
}

export interface AlertChannel {
  notify(alert: EdgeAlert): void;
}

/** Per-kind toggles - mirrors the AppSettings alert fields. */
export interface AlertPrefs {
  offerExpiring: boolean;
  raceOffSoon: boolean;
  resultSettled: boolean;
  nakedExposure: boolean;
  twoUpLock: boolean;
}
