/** Fired after a user dismiss marks an inbox row read (toast, OS shade). */
export const ALERT_INBOX_READ_EVENT = "edgeways:alert-inbox-read";

export function emitAlertInboxRead(dedupe: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ALERT_INBOX_READ_EVENT, { detail: { dedupe } })
  );
}
