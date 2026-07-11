/** Bookie wallet access - drives pickers and offer filters. */
export type BookieAccessStatus = "available" | "gubbed" | "closed";

export function normalizeAccessStatus(
  status: string | null | undefined
): BookieAccessStatus {
  if (status === "gubbed" || status === "closed") return status;
  return "available";
}

export function accessStatusLabel(status: BookieAccessStatus): string {
  if (status === "gubbed") return "Gubbed";
  if (status === "closed") return "Closed";
  return "Available";
}

/** Sort: available → gubbed → closed, then name. */
export function compareByAccessThenName(
  a: { accessStatus?: string | null; name: string },
  b: { accessStatus?: string | null; name: string }
): number {
  const rank = (s: string | null | undefined) => {
    const n = normalizeAccessStatus(s);
    return n === "available" ? 0 : n === "gubbed" ? 1 : 2;
  };
  const d = rank(a.accessStatus) - rank(b.accessStatus);
  if (d !== 0) return d;
  return a.name.localeCompare(b.name);
}

/** Competition name looks like World Cup / FIFA tournament. */
export function isWorldCupCompetition(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("world cup") ||
    n.includes("world-cup") ||
    /\bfifa\b/.test(n) ||
    /\bwc\b/.test(n) ||
    n.includes("copa del mundo")
  );
}
