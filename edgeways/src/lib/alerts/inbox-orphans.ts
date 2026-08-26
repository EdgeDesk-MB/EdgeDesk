/**
 * Map a condition-alert dedupe key to the desk row it is about.
 * Used to drop inbox leftovers (public-demo writes, deleted bets) that
 * no longer belong to this desk.
 */

export type InboxSubjectTable = "bets" | "offers" | "events";

export type InboxSubject = {
  table: InboxSubjectTable;
  id: number;
};

const BET_PREFIXES = ["naked_exposure:", "two_up_lock:"] as const;

function positiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Subject for a live-condition key, or null when the key is history / unknown. */
export function conditionAlertSubject(dedupe: string): InboxSubject | null {
  const key = dedupe.trim();
  if (!key) return null;

  for (const prefix of BET_PREFIXES) {
    if (!key.startsWith(prefix)) continue;
    const id = positiveInt(key.slice(prefix.length));
    return id != null ? { table: "bets", id } : null;
  }

  if (key.startsWith("race_off_soon:")) {
    const id = positiveInt(key.slice("race_off_soon:".length));
    return id != null ? { table: "events", id } : null;
  }

  const offer = /^offer_expiring:offer-(\d+)-/.exec(key);
  if (offer) {
    const id = positiveInt(offer[1] ?? "");
    return id != null ? { table: "offers", id } : null;
  }

  return null;
}

export function orphanConditionDedupes(
  dedupes: Iterable<string>,
  existing: Record<InboxSubjectTable, Set<number>>
): string[] {
  const gone: string[] = [];
  for (const key of dedupes) {
    const subject = conditionAlertSubject(key);
    if (!subject) continue;
    if (!existing[subject.table].has(subject.id)) gone.push(key);
  }
  return gone;
}
